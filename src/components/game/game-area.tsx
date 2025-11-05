"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "../ui/button";
import CountdownTimer from "./countdown-timer";
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, updateDoc, query, where, getDocs, writeBatch, getDoc, addDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { GameResult, User, Bet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Badge } from "../ui/badge";

type BetSelection = {
  type: 'color' | 'number' | 'size' | null;
  value: string | number | null;
};

export default function GameArea() {
  const [selection, setSelection] = useState<BetSelection>({ type: null, value: null });
  const [betAmount, setBetAmount] = useState(10);
  const [multiplier, setMultiplier] = useState(1);
  const [isBettingLocked, setIsBettingLocked] = useState(false);
  
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { user, firestore } = useFirebase();
  const { toast } = useToast();

   useEffect(() => {
    // Generate the initial round ID only on the client side to avoid hydration errors
    setCurrentRoundId(`round_${new Date().getTime()}`);
  }, []);

  const userRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userData } = useDoc<User>(userRef);

  const isBetReady = selection.type !== null && (betAmount * multiplier) > 0;

  const handleSelection = (type: 'color' | 'number' | 'size', value: string | number) => {
    if (isBettingLocked) return;
    if (selection.type === type && selection.value === value) {
        setSelection({ type: null, value: null });
    } else {
        setSelection({ type, value });
    }
  };
  
  const handleMultiplier = (m: number) => {
    if (isBettingLocked) return;
     if (multiplier === m) {
      setMultiplier(1);
    } else {
      setMultiplier(m);
    }
  }

  const handlePlaceBet = async () => {
    const totalBetAmount = betAmount * multiplier;
    if (!user || !firestore || !userData || !currentRoundId) {
      toast({ variant: "destructive", title: "Please log in to place a bet." });
      return;
    }
    if (isBettingLocked) {
      toast({ variant: "destructive", title: "Betting Locked", description: "You cannot place bets at this time." });
      return;
    }
    if (!selection.type || selection.value === null) {
       toast({ variant: "destructive", title: "Incomplete Selection", description: "Please select a color, number or size." });
       return;
    }
    if (userData.balance < totalBetAmount) {
        toast({ variant: "destructive", title: "Insufficient Balance", description: `You need INR ${totalBetAmount.toFixed(2)} to place this bet.` });
        return;
    }

    try {
      const newBalance = userData.balance - totalBetAmount;
      updateDoc(userRef, { balance: newBalance });
      
      const betChoice = `${selection.type}:${selection.value}`;

      const betData: Omit<Bet, 'id'> = {
        userId: user.uid,
        roundId: currentRoundId,
        choice: betChoice,
        amount: totalBetAmount,
        status: 'active',
        createdAt: Timestamp.now(),
        payout: 0,
        won: false,
      };

      await addDoc(collection(firestore, 'bets'), betData);

      toast({ title: "Bet Placed!", description: `INR ${totalBetAmount.toFixed(2)} on ${betChoice}.` });
      setSelection({ type: null, value: null });
      setMultiplier(1);
      
    } catch (error: any) {
      console.error("Error placing bet:", error);
      toast({ variant: "destructive", title: "Failed to place bet.", description: error.message });
      if (userRef && userData) {
        updateDoc(userRef, { balance: userData.balance });
      }
    }
  };
  
  const handleRoundEnd = useCallback(async () => {
    if (!firestore || !currentRoundId) return;
    setIsBettingLocked(true);
    setIsProcessing(true);

    try {
        const allBetsInRoundQuery = query(collection(firestore, 'bets'), where('roundId', '==', currentRoundId), where('status', '==', 'active'));
        const allBetsSnapshot = await getDocs(allBetsInRoundQuery);
        const activeBets = allBetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));

        // --- Winning Logic ---
        const colorTotals: { [color: string]: number } = { green: 0, orange: 0, white: 0 };
        activeBets.forEach(bet => {
            if (bet.choice.startsWith('color:')) {
                const color = bet.choice.split(':')[1];
                if (color in colorTotals) colorTotals[color] += bet.amount * 2; // Potential payout for color
            }
        });

        let winningColor: 'green' | 'orange' | 'white';
        if (activeBets.length > 0) {
            const minPayout = Math.min(...Object.values(colorTotals));
            const tiedColors = (Object.keys(colorTotals) as ('green' | 'orange' | 'white')[]).filter(c => colorTotals[c] === minPayout);
            winningColor = tiedColors[Math.floor(Math.random() * tiedColors.length)];
        } else {
            const colors: ('green' | 'orange' | 'white')[] = ['green', 'orange', 'white'];
            winningColor = colors[Math.floor(Math.random() * colors.length)];
        }

        const winningNumber = Math.floor(Math.random() * 10);
        const winningSize = winningNumber >= 5 ? 'big' : 'small';

        // --- Store Result and Update UI ---
        const resultData: GameResult = {
            id: currentRoundId,
            gameId: currentRoundId,
            resultNumber,
            resultColor: winningColor,
            resultSize: winningSize,
            startTime: new Date().toISOString(),
            status: 'finished'
        };
        
        const roundDocRef = doc(firestore, 'game_rounds', currentRoundId);
        await setDoc(roundDocRef, resultData); // Save the result first!
        setGameResult(resultData); // Update state to show result on UI

        // --- Process Bets ---
        if (activeBets.length > 0) {
            const batch = writeBatch(firestore);
            const userPayouts: { [userId: string]: number } = {};

            activeBets.forEach(bet => {
                const betDocRef = doc(firestore, 'bets', bet.id);
                const [betType, betValue] = bet.choice.split(':');
                let didWin = false;
                let payout = 0;

                if (betType === 'color' && betValue === winningColor) { didWin = true; payout = bet.amount * 2; }
                if (betType === 'number' && Number(betValue) === winningNumber) { didWin = true; payout = bet.amount * 9; }
                if (betType === 'size' && betValue === winningSize) { didWin = true; payout = bet.amount * 1.5; }

                if (didWin) {
                    batch.update(betDocRef, { status: 'win', won: true, payout: payout });
                    userPayouts[bet.userId] = (userPayouts[bet.userId] || 0) + payout;
                } else {
                    batch.update(betDocRef, { status: 'loss', won: false, payout: 0 });
                }
            });

            await batch.commit();

            // --- Distribute Payouts ---
            if (Object.keys(userPayouts).length > 0) {
                const userUpdatePromises = Object.keys(userPayouts).map(async (uid) => {
                    const userToUpdateRef = doc(firestore, 'users', uid);
                    try {
                        const userDoc = await getDoc(userToUpdateRef);
                        if (userDoc.exists()) {
                            const currentBalance = userDoc.data().balance || 0;
                            await updateDoc(userToUpdateRef, { balance: currentBalance + userPayouts[uid] });
                            if (user && uid === user.uid) {
                                toast({ title: "You Won!", description: `INR ${userPayouts[uid].toFixed(2)} added to your wallet.` });
                            }
                        }
                    } catch (e) { console.error(`Failed to update balance for user ${uid}:`, e); }
                });
                await Promise.allSettled(userUpdatePromises);
            }
        }
    } catch (error) {
        console.error("Error in handleRoundEnd: ", error);
        toast({ variant: "destructive", title: "Round Error", description: "Could not process round results." });
    } finally {
        setIsProcessing(false);
    }
  }, [firestore, currentRoundId, user, toast]);
  
  const handleNewRound = useCallback(() => {
    setIsBettingLocked(false);
    setGameResult(null);
    setSelection({ type: null, value: null });
    setMultiplier(1);
    setCurrentRoundId(`round_${new Date().getTime()}`);
  }, []);
  
  const numberToColorClass = (num: number) => {
    if ([1,3,7,9].includes(num)) return 'bg-green-500 text-white';
    if ([2,4,6,8].includes(num)) return 'bg-orange-500 text-white';
    if ([0,5].includes(num)) return 'bg-white text-purple-700 border-2 border-purple-500';
    return 'bg-gray-500';
  }
  
  const colorToVariant = (color: string): "green" | "white" | "orange" => {
    if (color === 'green') return 'green';
    if (color === 'white') return 'white';
    return 'orange';
  }

  if (!currentRoundId) return <div className="text-center p-4">Initializing Game...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-2 rounded-lg">
          <div>
            <p className="text-sm text-gray-400">Win Go 1 Min</p>
            <p className="text-lg font-bold">{currentRoundId.slice(-6)}</p>
          </div>
          <div className="text-right">
             <p className="text-sm text-gray-400">Time Remaining</p>
            <CountdownTimer onRoundEnd={handleRoundEnd} onNewRound={handleNewRound} roundId={currentRoundId} />
          </div>
      </div>
      
      {isBettingLocked && (
        <div className="bg-card p-4 rounded-lg text-center">
            {isProcessing ? (
                <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Calculating result...</span>
                </div>
            ) : gameResult ? (
                 <div className="flex flex-col items-center gap-3">
                    <p className="font-bold">Result for {gameResult.gameId.slice(-6)}</p>
                    <div className="grid grid-cols-3 gap-2 w-full max-w-xs text-center">
                      <div className="p-2 bg-background/50 rounded">
                        <p className="text-xs text-muted-foreground">Number</p>
                        <p className={cn("text-xl font-bold", numberToColorClass(gameResult.resultNumber).replace('bg-', 'text-'))}>{gameResult.resultNumber}</p>
                      </div>
                       <div className="p-2 bg-background/50 rounded">
                        <p className="text-xs text-muted-foreground">Size</p>
                        <p className="text-xl font-bold capitalize">{gameResult.resultSize}</p>
                      </div>
                       <div className="p-2 bg-background/50 rounded">
                        <p className="text-xs text-muted-foreground">Color</p>
                        <div className="flex justify-center items-center gap-1.5">
                            <div className={cn("w-4 h-4 rounded-full", numberToColorClass(gameResult.resultNumber))}></div>
                            <p className="text-xl font-bold capitalize">{gameResult.resultColor}</p>
                        </div>
                      </div>
                    </div>
                </div>
            ) : (
                <p>Waiting for the next round...</p>
            )}
        </div>
      )}

      <div className={cn("bg-card p-4 rounded-lg space-y-4", isBettingLocked && 'opacity-50 pointer-events-none')}>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={selection.type === 'color' && selection.value === 'green' ? 'default' : 'green'}
              onClick={() => handleSelection('color', 'green')} >
              Green
            </Button>
            <Button
              variant={selection.type === 'color' && selection.value === 'white' ? 'default' : 'white'}
              onClick={() => handleSelection('color', 'white')}>
              White
            </Button>
            <Button
              variant={selection.type === 'color' && selection.value === 'orange' ? 'default' : 'orange'}
              onClick={() => handleSelection('color', 'orange')}>
              Orange
            </Button>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i).map(num => (
              <Button 
                  key={num}
                  variant='secondary'
                  size="circle"
                  className={cn("h-12 w-12 text-lg", numberToColorClass(num), selection.type === 'number' && selection.value === num && 'ring-2 ring-offset-2 ring-primary')}
                  onClick={() => handleSelection('number', num)}>
                  {num}
              </Button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-2">
              <Button size="lg" variant={selection.value === 'big' ? 'default' : 'secondary'} onClick={() => handleSelection('size', 'big')}>Big</Button>
              <Button size="lg" variant={selection.value === 'small' ? 'default' : 'secondary'} onClick={() => handleSelection('size', 'small')}>Small</Button>
          </div>

          <div className="flex items-center gap-2">
              <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))} className="w-20 bg-input rounded-md p-2 text-center" />
              <div className="grid grid-cols-4 gap-2 flex-grow">
                  {[1, 5, 10, 20].map(m => (
                      <Button key={m} variant={multiplier === m ? 'default' : 'secondary'} onClick={() => handleMultiplier(m)}>X{m}</Button>
                  ))}
              </div>
          </div>

          <Button className="w-full h-12" onClick={handlePlaceBet} disabled={!isBetReady}>
              Bet (Total: INR {(betAmount * multiplier).toFixed(2)})
          </Button>
        </div>
    </div>
  );
}
