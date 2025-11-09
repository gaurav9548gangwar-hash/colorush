
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CountdownTimer } from './countdown-timer'
import { PlaceBetDialog } from './place-bet-dialog'
import { useFirebase } from '@/firebase'
import { PastResultsTab } from './past-results-tab'
import { MyBetsTab } from './my-bets-tab'
import { useGameStore } from '@/lib/game-store'

const TelegramIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M22 2L11 13" />
        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
);

export function GameArea() {
  const { user } = useFirebase()
  
  const { 
    currentRoundId, 
    isProcessing,
    gameResult 
  } = useGameStore();

  const [isBettingLocked, setIsBettingLocked] = useState(false);

  useEffect(() => {
    const lockTimer = setTimeout(() => {
        setIsBettingLocked(true);
    }, 55 * 1000);

    // Reset lock for new round
    setIsBettingLocked(false);

    return () => clearTimeout(lockTimer);
  }, [currentRoundId]);


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
          <CountdownTimer />
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
            {user ? <MyBetsTab userId={user.uid} /> : <p className="text-center py-4">Please log in to see your bets.</p>}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex-col items-center justify-center pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          For any issues, you can contact us on Telegram.
        </p>
        <Button variant="link" asChild className="mt-1">
          <a href="https://t.me/Tirangaavingo" target="_blank" rel="noopener noreferrer">
            <TelegramIcon className="mr-2 h-4 w-4" />
            @Tirangaavingo
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}
