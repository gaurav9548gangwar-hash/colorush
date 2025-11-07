'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CountdownTimer } from './countdown-timer'
import { PlaceBetDialog } from './place-bet-dialog'
import { useFirebase } from '@/firebase'
import type { Bet, BetColor, BetSize, GameResult, User } from '@/lib/types'
import { collection, doc, writeBatch, serverTimestamp, updateDoc, increment, query, where, getDocs, getDoc, type Firestore, setDoc } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { PastResultsTab } from './past-results-tab'
import { MyBetsTab } from './my-bets-tab'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

const getWinningSize = (num: number): BetSize => (num >= 5 ? 'big' : 'small')

const getWinningColor = (num: number): BetColor => {
  if (num === 0 || num === 5) return 'white'
  if ([1, 3, 7, 9].includes(num)) return 'green'
  return 'orange'
}

const TelegramIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M22 2L11 13" />
        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
);


export function GameArea() {
  const { firestore, user } = useFirebase()
  const { toast } = useToast()

  const [currentRoundId, setCurrentRoundId] = useState<string>('')
  const [isBettingLocked, setIsBettingLocked] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  
  const handleNewRound = useCallback(() => {
    setIsProcessing(false)
    setIsBettingLocked(false)
    setGameResult(null)
    const newRoundId = new Date().getTime().toString();
    setCurrentRoundId(newRoundId)
  }, [])
  
  useEffect(() => {
    handleNewRound()
  }, [handleNewRound])

  const handleRoundEnd = useCallback(async () => {
    if (!firestore || !currentRoundId || !user) return;

    setIsBettingLocked(true);
    setIsProcessing(true);

    let currentUserData: User | null = null;
    try {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            currentUserData = userDoc.data() as User;
        }
    } catch(e) {
        console.error("Could not fetch user data for round logic: ", e);
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
        setIsProcessing(false);
        return;
    }

    let winningNumber: number;
    const userBetsInRound = betsToProcess.filter(bet => bet.userId === user.uid);
    const userHasBet = userBetsInRound.length > 0;
    const randomLossStreak = Math.floor(Math.random() * 5) + 5; // 5 to 10

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

        if (currentUserData.inWinningPhase) {
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
                // This case is unlikely if user has bet, but as a fallback, make them lose.
                const losingOptions = getUserLosingNumbers();
                winningNumber = losingOptions.length > 0 ? losingOptions[Math.floor(Math.random() * losingOptions.length)] : Math.floor(Math.random() * 10);
            }
        } else { // Force Loss
            const losingOptions = getUserLosingNumbers();
            if (losingOptions.length > 0) {
                winningNumber = losingOptions[Math.floor(Math.random() * losingOptions.length)];
            } else {
                // User bet on everything. As a fallback, pick a random number.
                winningNumber = Math.floor(Math.random() * 10);
            }
        }

    } else {
        // Default behavior if no user data or user hasn't bet: minimize house payout
        const potentialPayouts: { [num: number]: number } = {};
        for (let i = 0; i <= 9; i++) { potentialPayouts[i] = 0; }
        
        betsToProcess.forEach(bet => {
            for (let i = 0; i <= 9; i++) {
                const winningColor = getWinningColor(i);
                const winningSize = getWinningSize(i);
                let multiplier = 0;

                if (bet.type === 'number' && bet.target === i) multiplier = 9;
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
    
            if (bet.type === 'number' && bet.target === resultData.winningNumber) multiplier = 9;
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
        
        if(currentUserData && user.uid in userWinLoss) {
            const userRef = doc(firestore, "users", user.uid);
            let userDataUpdate: any = {};

            if (currentUserData.inWinningPhase && currentUserData.balance + (userPayouts[user.uid] || 0) >= currentUserData.targetBalance) {
                userDataUpdate.inWinningPhase = false;
                userDataUpdate.betsSinceLastWin = 0;
            } else if (!currentUserData.inWinningPhase) {
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
        setIsProcessing(false);
    }
  }, [firestore, currentRoundId, toast, user]);

  const renderResult = () => {
    if (!gameResult) {
        if (isProcessing) {
             return <div className="flex flex-col items-center justify-center space-y-4 p-8 rounded-lg bg-card-foreground/5"><p>Calculating result...</p></div>
        }
        return null;
    }

    return (
      <div className="animate-in fade-in-50 flex flex-col items-center justify-center space-y-4 p-8 rounded-lg bg-card-foreground/5">
        <h3 className="text-2xl font-bold">Round {gameResult.roundId.substring(9, 13)} Result</h3>
        <div className="flex items-center space-x-4">
          <div className="flex flex-col items-center">
            <span className="text-sm text-muted-foreground">Number</span>
            <span className={`text-5xl font-bold text-${gameResult.winningColor}-500`}>{gameResult.winningNumber}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-muted-foreground">Color</span>
            <span className={`text-3xl font-bold capitalize text-${gameResult.winningColor}-500`}>{gameResult.winningColor}</span>
          </div>
           <div className="flex flex-col items-center">
            <span className="text-sm text-muted-foreground">Size</span>
            <span className="text-3xl font-bold capitalize">{gameResult.winningSize}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground">Round ID</p>
            <p className="text-lg font-semibold">{currentRoundId.substring(9, 13)}</p>
          </div>
          <CountdownTimer 
            key={currentRoundId} 
            roundId={currentRoundId}
            onRoundEnd={handleRoundEnd}
            onNewRound={handleNewRound}
          />
          <div className="flex items-center justify-center">
             <Button variant="outline" onClick={() => window.location.reload()}>Refresh Game</Button>
          </div>
        </div>

        {isBettingLocked || gameResult ? (
            renderResult()
        ) : (
          <div className="space-y-4 animate-in fade-in-20">
            <div className="grid grid-cols-3 gap-2">
              <PlaceBetDialog type="color" target="green" roundId={currentRoundId} disabled={isBettingLocked} />
              <PlaceBetDialog type="color" target="white" roundId={currentRoundId} disabled={isBettingLocked} />
              <PlaceBetDialog type="color" target="orange" roundId={currentRoundId} disabled={isBettingLocked} />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <PlaceBetDialog key={num} type="number" target={num} roundId={currentRoundId} disabled={isBettingLocked} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <PlaceBetDialog type="size" target="small" roundId={currentRoundId} disabled={isBettingLocked} />
                <PlaceBetDialog type="size" target="big" roundId={currentRoundId} disabled={isBettingLocked} />
            </div>
          </div>
        )}

        <Tabs defaultValue="myBets" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pastResults">Past Results</TabsTrigger>
            <TabsTrigger value="myBets">My Bet History</TabsTrigger>
          </TabsList>
          <TabsContent value="pastResults">
            <PastResultsTab />
          </TabsContent>
          <TabsContent value="myBets">
            {user ? <MyBetsTab userId={user.uid} key={currentRoundId} /> : <p className="text-center py-4">Please log in to see your bets.</p>}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex-col items-center justify-center pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          Kisi bhi samasya ke liye, aap humse Telegram par sampark kar sakte hain.
        </p>
        <Button variant="link" asChild className="mt-1">
          <a href="https://t.me/ColoRushSupport" target="_blank" rel="noopener noreferrer">
            <TelegramIcon className="mr-2 h-4 w-4" />
            @ColoRushSupport
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

    