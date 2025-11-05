'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CountdownTimer } from './countdown-timer'
import { PlaceBetDialog } from './place-bet-dialog'
import { useFirebase } from '@/firebase'
import type { Bet, BetColor, BetSize, BetTarget, GameResult } from '@/lib/types'
import { collection, doc, writeBatch, serverTimestamp, updateDoc, increment } from 'firebase/firestore'
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

export function GameArea() {
  const { firestore, user } = useFirebase()
  const { toast } = useToast()

  const [currentRoundId, setCurrentRoundId] = useState<string>('')
  const [isBettingLocked, setIsBettingLocked] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [currentRoundBets, setCurrentRoundBets] = useState<Omit<Bet, 'id'>[]>([]);
  
  const handleNewRound = useCallback(() => {
    setIsProcessing(false)
    setIsBettingLocked(false)
    setGameResult(null)
    setCurrentRoundBets([])
    const newRoundId = new Date().getTime().toString();
    setCurrentRoundId(newRoundId)
  }, [])
  
  useEffect(() => {
    handleNewRound()
  }, [handleNewRound])

  const onBetPlaced = (bet: Omit<Bet, 'id'>) => {
    setCurrentRoundBets(prevBets => [...prevBets, bet]);
  };

  const handleRoundEnd = useCallback(async () => {
    if (!firestore || !currentRoundId) return;

    setIsBettingLocked(true);
    setIsProcessing(true);

    let resultData: GameResult;
    let betsToProcess = [...currentRoundBets];

    const potentialPayouts: { [key in BetTarget | 'green' | 'orange' | 'white']: number } = {
        green: 0, orange: 0, white: 0,
        small: 0, big: 0,
        0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
    };

    betsToProcess.forEach(bet => {
        let payout = 0;
        const betNum = typeof bet.target === 'number' ? bet.target : -1;

        if (bet.type === 'color') {
            const color = bet.target as BetColor;
            payout = bet.amount * (color === 'white' ? 4.5 : 2);
            potentialPayouts[color] += payout;
        } else if (bet.type === 'number' && betNum !== -1) {
            payout = bet.amount * 9;
            potentialPayouts[betNum] += payout;
        } else if (bet.type === 'size') {
            payout = bet.amount * 2;
            potentialPayouts[bet.target as BetSize] += payout;
        }
    });
    
    const combinedColorPayouts = {
        green: potentialPayouts.green + potentialPayouts[1] + potentialPayouts[3] + potentialPayouts[7] + potentialPayouts[9],
        orange: potentialPayouts.orange + potentialPayouts[2] + potentialPayouts[4] + potentialPayouts[6] + potentialPayouts[8],
        white: potentialPayouts.white + potentialPayouts[0] + potentialPayouts[5]
    }

    let leastPayoutColor: BetColor = 'green';
    let minPayout = combinedColorPayouts.green;

    if (combinedColorPayouts.orange < minPayout) {
        minPayout = combinedColorPayouts.orange;
        leastPayoutColor = 'orange';
    }
    if (combinedColorPayouts.white < minPayout) {
        leastPayoutColor = 'white';
    }

    const possibleNumbers = {
        green: [1, 3, 7, 9],
        orange: [2, 4, 6, 8],
        white: [0, 5],
    }[leastPayoutColor];
    
    const winningNumber = possibleNumbers[Math.floor(Math.random() * possibleNumbers.length)];
    const winningColor = getWinningColor(winningNumber);
    const winningSize = getWinningSize(winningNumber);

    resultData = {
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

        for (const bet of betsToProcess) {
            const betDocRef = doc(collection(firestore, 'bets'));
            let hasWon = false;
            let payout = 0;
    
            if (bet.type === 'number' && bet.target === resultData.winningNumber) {
                hasWon = true;
                payout = bet.amount * 9;
            } else if (bet.type === 'color' && bet.target === resultData.winningColor) {
                hasWon = true;
                payout = bet.amount * (resultData.winningColor === 'white' ? 4.5 : 2);
            } else if (bet.type === 'size' && bet.target === resultData.winningSize) {
                hasWon = true;
                payout = bet.amount * 2;
            }
    
            batch.set(betDocRef, {
                ...bet,
                id: betDocRef.id,
                status: hasWon ? 'win' : 'loss',
                payout,
                createdAt: serverTimestamp(),
            });
    
            if (hasWon) {
                userPayouts[bet.userId] = (userPayouts[bet.userId] || 0) + payout;
            }
        }
        
        await batch.commit();

        for (const userId in userPayouts) {
            if (userPayouts[userId] > 0) {
                 const userRef = doc(firestore, "users", userId);
                 try {
                     // Atomically increment the user's balance
                     await updateDoc(userRef, {
                         balance: increment(userPayouts[userId])
                     });
                 } catch (e) {
                      const contextualError = new FirestorePermissionError({
                         path: userRef.path,
                         operation: 'update',
                         requestResourceData: { balance: `increment(${userPayouts[userId]})` },
                      });
                      errorEmitter.emit('permission-error', contextualError);
                      console.error(`Failed to update balance for user ${userId}:`, e);
                      toast({ variant: "destructive", title: "Balance Update Error", description: `Could not update balance for user ${userId}.` })
                 }
            }
        }

    } catch (error) {
      console.error("Error saving round results to DB: ", error);
      toast({ variant: "destructive", title: "Save Error", description: "Could not save round results." });
    } finally {
        setIsProcessing(false);
    }
  }, [firestore, currentRoundId, toast, currentRoundBets]);

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
              <PlaceBetDialog onBetPlaced={onBetPlaced} type="color" target="green" roundId={currentRoundId} disabled={isBettingLocked} />
              <PlaceBetDialog onBetPlaced={onBetPlaced} type="color" target="white" roundId={currentRoundId} disabled={isBettingLocked} />
              <PlaceBetDialog onBetPlaced={onBetPlaced} type="color" target="orange" roundId={currentRoundId} disabled={isBettingLocked} />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <PlaceBetDialog onBetPlaced={onBetPlaced} key={num} type="number" target={num} roundId={currentRoundId} disabled={isBettingLocked} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <PlaceBetDialog onBetPlaced={onBetPlaced} type="size" target="small" roundId={currentRoundId} disabled={isBettingLocked} />
                <PlaceBetDialog onBetPlaced={onBetPlaced} type="size" target="big" roundId={currentRoundId} disabled={isBettingLocked} />
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
    </Card>
  )
}
