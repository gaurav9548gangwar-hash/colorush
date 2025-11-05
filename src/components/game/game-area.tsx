'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CountdownTimer } from './countdown-timer'
import { PlaceBetDialog } from './place-bet-dialog'
import { useFirebase } from '@/firebase'
import type { Bet, BetColor, BetSize, BetTarget, GameResult } from '@/lib/types'
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { v4 as uuidv4 } from 'uuid'
import { PastResultsTab } from './past-results-tab'
import { MyBetsTab } from './my-bets-tab'

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
    setCurrentRoundId(uuidv4())
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
  
      const potentialPayouts: { [key in BetTarget]: number } = {
        green: 0, orange: 0, white: 0,
        small: 0, big: 0,
        0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
      };
  
      bets.forEach(bet => {
        let payout = 0;
        if (bet.type === 'color') {
            payout = bet.amount * (bet.target === 'white' ? 4.5 : 2);
        } else if (bet.type === 'number') {
            payout = bet.amount * 9;
        } else if (bet.type === 'size') {
            payout = bet.amount * 2;
        }

        if (bet.type === 'number') {
            const num = bet.target as number;
            potentialPayouts[num] += payout;
            potentialPayouts[getWinningColor(num)] += payout;
            potentialPayouts[getWinningSize(num)] += payout;
        } else {
            potentialPayouts[bet.target as BetColor | BetSize] += payout;
        }
      });
  
      const numberPayouts = Object.entries(potentialPayouts).slice(5).map(([key, value]) => ({num: parseInt(key), payout: value}));
      
      let sortedNumbers = numberPayouts.sort((a,b) => a.payout - b.payout);

      // Add randomness to make it less predictable
      const top3 = sortedNumbers.slice(0,3);
      const randomIndex = Math.floor(Math.random() * top3.length);
      const winningNumber = top3[randomIndex].num;
      
      const winningColor = getWinningColor(winningNumber);
      const winningSize = getWinningSize(winningNumber);
  
      const resultData: GameResult = {
        roundId: currentRoundId,
        winningNumber,
        winningColor,
        winningSize,
        endedAt: serverTimestamp() as any,
      };

      setGameResult(resultData);
  
      const batch = writeBatch(firestore);
      const roundDocRef = doc(firestore, 'game_rounds', currentRoundId);
      batch.set(roundDocRef, resultData);
  
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
          const userDocRef = doc(firestore, 'users', bet.userId);
          batch.update(userDocRef, { balance: payout });
        }
      }
      
      await batch.commit();

    } catch (error) {
      console.error("Error in handleRoundEnd: ", error);
      toast({ variant: "destructive", title: "Round Error", description: "Could not process round results." });
    } finally {
      setIsProcessing(false);
    }
  }, [firestore, currentRoundId, toast, handleNewRound]);

  const renderResult = () => {
    if (!gameResult) return null

    return (
      <div className="animate-in fade-in-50 flex flex-col items-center justify-center space-y-4 p-8 rounded-lg bg-card-foreground/5">
        <h3 className="text-2xl font-bold">Round {gameResult.roundId.substring(0, 5)} Result</h3>
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
            <p className="text-lg font-semibold">{currentRoundId.substring(0, 13)}</p>
          </div>
          <CountdownTimer 
            key={currentRoundId} 
            roundId={currentRoundId}
            onRoundEnd={handleRoundEnd}
            onNewRound={handleNewRound}
          />
          <div className="flex items-center justify-center">
            {/* Future content like "How to Play" can go here */}
          </div>
        </div>

        {isProcessing || gameResult ? (
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
            {user && <MyBetsTab userId={user.uid} />}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
