'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CountdownTimer } from './countdown-timer'
import { PlaceBetDialog } from './place-bet-dialog'
import { useFirebase } from '@/firebase'
import type { Bet, BetColor, BetSize, BetTarget, GameResult } from '@/lib/types'
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, updateDoc, increment } from 'firebase/firestore'
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
    if (!firestore || !currentRoundId) return;
  
    setIsBettingLocked(true);
    setIsProcessing(true);
  
    try {
        const betsRef = collection(firestore, 'bets');
        const q = query(betsRef, where('roundId', '==', currentRoundId));
        const betSnapshot = await getDocs(q);
        const bets = betSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
  
        const potentialPayouts: { [key in BetTarget | 'green' | 'orange' | 'white']: number } = {
            green: 0, orange: 0, white: 0,
            small: 0, big: 0,
            0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
        };

        bets.forEach(bet => {
            let payout = 0;
            if (bet.type === 'color') {
                payout = bet.amount * (bet.target === 'white' ? 4.5 : 2);
                 const color = bet.target as BetColor;
                 potentialPayouts[color] += payout;

            } else if (bet.type === 'number') {
                payout = bet.amount * 9;
                const num = bet.target as number;
                potentialPayouts[num] += payout;

                // Add number payout to its corresponding color
                const colorOfNum = getWinningColor(num);
                potentialPayouts[colorOfNum] += payout;

            } else if (bet.type === 'size') {
                payout = bet.amount * 2;
                potentialPayouts[bet.target as BetSize] += payout;
            }
        });
        
        const colorPayouts = [
            { color: 'green', payout: potentialPayouts.green },
            { color: 'orange', payout: potentialPayouts.orange },
            { color: 'white', payout: potentialPayouts.white },
        ];
        
        colorPayouts.sort((a,b) => a.payout - b.payout);
        const leastPayoutColor = colorPayouts[0].color as BetColor;

        const possibleNumbers = {
            green: [1, 3, 7, 9],
            orange: [2, 4, 6, 8],
            white: [0, 5],
        }[leastPayoutColor];
        
        const winningNumber = possibleNumbers[Math.floor(Math.random() * possibleNumbers.length)];
        const winningColor = getWinningColor(winningNumber);
        const winningSize = getWinningSize(winningNumber);
  
        const resultData: GameResult = {
            id: currentRoundId,
            roundId: currentRoundId,
            winningNumber,
            winningColor,
            winningSize,
            endedAt: serverTimestamp() as any, // This will be set on the server
        };

        // Instantly display result on UI
        setGameResult(resultData);
    
        // Update database in the background
        const batch = writeBatch(firestore);
        const roundDocRef = doc(firestore, 'game_rounds', currentRoundId);
        batch.set(roundDocRef, {
            ...resultData,
            endedAt: serverTimestamp() // ensure timestamp is set for db
        });
  
        const userPayouts: { [userId: string]: number } = {};

        for (const bet of bets) {
            const betDocRef = doc(firestore, 'bets', bet.id);
            let hasWon = false;
            let payout = 0;
    
            if (bet.type === 'number' && bet.target === winningNumber) {
                hasWon = true;
                payout = bet.amount * 9;
            } else if (bet.type === 'color' && bet.target === winningColor) {
                hasWon = true;
                payout = bet.amount * (winningColor === 'white' ? 4.5 : 2);
            } else if (bet.type === 'size' && bet.target === winningSize) {
                hasWon = true;
                payout = bet.amount * 2;
            }
    
            batch.update(betDocRef, { status: hasWon ? 'win' : 'loss', payout });
    
            if (hasWon) {
                if (!userPayouts[bet.userId]) {
                    userPayouts[bet.userId] = 0;
                }
                userPayouts[bet.userId] += payout;
            }
        }

        await batch.commit();

        // Separate balance updates for winners
        for (const userId in userPayouts) {
            if (userPayouts[userId] > 0) {
                 const userRef = doc(firestore, "users", userId);
                 try {
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
      console.error("Error in handleRoundEnd: ", error);
      toast({ variant: "destructive", title: "Round Error", description: "Could not process round results." });
    } finally {
        setIsProcessing(false);
    }
  }, [firestore, currentRoundId, toast]);

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

        <Tabs defaultValue="pastResults" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pastResults">Past Results</TabsTrigger>
            <TabsTrigger value="myBets">My Bet History</TabsTrigger>
          </TabsList>
          <TabsContent value="pastResults">
            <PastResultsTab />
          </TabsContent>
          <TabsContent value="myBets">
            {user && <MyBetsTab userId={user.uid} key={currentRoundId} />}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
