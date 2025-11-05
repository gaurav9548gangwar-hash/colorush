"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
} from "../ui/card";
import CountdownTimer from "./countdown-timer";
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, updateDoc, query, orderBy, limit, getDoc, writeBatch, getDocs, where, Timestamp, addDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { GameResult, User, Bet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { List } from "lucide-react";

type BetSelection = {
  type: 'color' | 'number' | 'size' | null;
  value: string | number | null;
};

export default function GameArea() {
  const [selection, setSelection] = useState<BetSelection>({ type: null, value: null });
  const [betAmount, setBetAmount] = useState(10);
  const [multiplier, setMultiplier] = useState(1);
  const [isBettingLocked, setIsBettingLocked] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
  
  const [pastResults, setPastResults] = useState<GameResult[]>([]);
  const [myBets, setMyBets] = useState<Bet[]>([]);

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

  // Real-time listener for past game results (last 10)
  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, 'game_rounds'), orderBy('startTime', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as GameResult));
      setPastResults(results);
    });
    return () => unsubscribe();
  }, [firestore]);

  // Real-time listener for the current user's bets
  useEffect(() => {
    if (!firestore || !user) {
        setMyBets([]);
        return;
    };
    
    const q = query(collection(firestore, 'bets'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(10));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const bets = snapshot.docs.map(doc => ({...doc.data(), id: doc.id} as Bet));
        setMyBets(bets);
    });

    return () => unsubscribe();
  }, [firestore, user]);

  const handleSelection = (type: 'color' | 'number' | 'size', value: string | number) => {
    if (isBettingLocked) return;
    setSelection({ type, value });
  };
  
  const handleMultiplier = (m: number) => {
    if (isBettingLocked) return;
    setMultiplier(m);
  }

  const isBetReady = selection.type !== null && (betAmount * multiplier) > 0;

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

    try {
      const allBetsInRoundQuery = query(collection(firestore, 'bets'), where('roundId', '==', currentRoundId), where('status', '==', 'active'));
      const allBetsSnapshot = await getDocs(allBetsInRoundQuery);
      const activeBets = allBetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));

      // Smart logic to determine winning color (minimum potential payout)
      const colorTotals: { [color: string]: number } = { green: 0, orange: 0, white: 0 };
      activeBets.forEach(bet => {
        if (bet.choice.startsWith('color:')) {
          const color = bet.choice.split(':')[1];
          if (color in colorTotals) colorTotals[color] += bet.amount * 2;
        }
      });
      let winningColor: 'green' | 'orange' | 'white' = 'green';
      if (activeBets.length > 0) {
        const minBet = Math.min(...Object.values(colorTotals));
        const tiedColors = (Object.keys(colorTotals) as ('green' | 'orange' | 'white')[]).filter(c => colorTotals[c] === minBet);
        winningColor = tiedColors[Math.floor(Math.random() * tiedColors.length)];
      } else {
         const colors: ('green' | 'orange' | 'white')[] = ['green', 'orange', 'white'];
         winningColor = colors[Math.floor(Math.random() * colors.length)];
      }

      const winningNumber = Math.floor(Math.random() * 10);
      const winningSize = winningNumber >= 5 ? 'big' : 'small';
      
      const resultData: GameResult = { id: currentRoundId, gameId: currentRoundId, resultNumber, resultColor: winningColor, resultSize: winningSize, startTime: new Date().toISOString(), status: 'finished' };
      setGameResult(resultData);

      const batch = writeBatch(firestore);
      const userPayouts: { [userId: string]: number } = {};

      activeBets.forEach(bet => {
        const betDocRef = doc(firestore, 'bets', bet.id);
        const [betType, betValue] = bet.choice.split(':');
        let didWin = false; let payout = 0;

        if (betType === 'color' && betValue === winningColor) { didWin = true; payout = bet.amount * 2; }
        else if (betType === 'number' && Number(betValue) === winningNumber) { didWin = true; payout = bet.amount * 9; }
        else if (betType === 'size' && betValue === winningSize) { didWin = true; payout = bet.amount * 1.5; }

        if (didWin) {
          batch.update(betDocRef, { status: 'win', won: true, payout });
          userPayouts[bet.userId] = (userPayouts[bet.userId] || 0) + payout;
        } else {
          batch.update(betDocRef, { status: 'loss', won: false, payout: 0 });
        }
      });
      
      batch.set(doc(firestore, 'game_rounds', currentRoundId), resultData);
      await batch.commit();

      // Update user balances after batch commit
      if (Object.keys(userPayouts).length > 0) {
        const userUpdatePromises = Object.keys(userPayouts).map(async (uid) => {
          const userToUpdateRef = doc(firestore, 'users', uid);
          try {
            const userDoc = await getDoc(userToUpdateRef);
            if (userDoc.exists()) {
              const currentBalance = userDoc.data().balance || 0;
              await updateDoc(userToUpdateRef, { balance: currentBalance + userPayouts[uid] });
              if(user && uid === user.uid) toast({ title: "You Won!", description: `INR ${userPayouts[uid].toFixed(2)} added to your wallet.` });
            }
          } catch (e) { console.error(`Failed to update balance for user ${uid}:`, e); }
        });
        await Promise.allSettled(userUpdatePromises);
      }
    } catch(error) { console.error("Error in handleRoundEnd: ", error); }
  }, [firestore, currentRoundId, user, toast]);
  
  const handleNewRound = useCallback(() => {
    setGameResult(null);
    setIsBettingLocked(false);
    setSelection({ type: null, value: null });
    setCurrentRoundId(`round_${new Date().getTime()}`);
  }, []);
  
  const numberToColor = (num: number) => {
    if ([1,3,7,9].includes(num)) return 'bg-green-500';
    if ([2,4,6,8].includes(num)) return 'bg-orange-500';
    if ([0,5].includes(num)) return 'bg-white text-purple-700 border-2 border-purple-500';
    return 'bg-gray-500';
  }

  if (!currentRoundId) return <div className="text-center p-4">Initializing Game...</div>;

  return (
    <section className="space-y-4 relative">
      <Card className="bg-primary/20">
        <CardContent className="p-2">
            <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" className="text-xs"><List className="mr-1 h-3 w-3" /> How to play</Button>
                <div className="text-right">
                    <p className="text-xs text-gray-400">Time remaining</p>
                    <CountdownTimer onRoundEnd={handleRoundEnd} onNewRound={handleNewRound} roundId={currentRoundId} />
                </div>
            </div>
            <div className="flex items-center justify-between mt-2 px-2">
                <p className="text-sm">Win Go 1Min</p>
                <p className="text-sm font-mono">{currentRoundId}</p>
            </div>
            <div className="flex space-x-2 p-2 overflow-x-auto">
                {pastResults.slice(0, 5).map(r => (
                    <div key={r.id} className={cn("flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-white", numberToColor(r.resultNumber))}>
                        {r.resultNumber}
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>
      

      <Card className="bg-background/30 border-primary/50">
        <CardContent className="p-2 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={selection.type === 'color' && selection.value === 'green' ? 'default' : 'green'}
              onClick={() => handleSelection('color', 'green')} disabled={isBettingLocked} >
              Green
            </Button>
            <Button
              variant={selection.type === 'color' && selection.value === 'white' ? 'default' : 'white'}
              onClick={() => handleSelection('color', 'white')} disabled={isBettingLocked}>
              White
            </Button>
            <Button
              variant={selection.type === 'color' && selection.value === 'orange' ? 'default' : 'orange'}
              onClick={() => handleSelection('color', 'orange')} disabled={isBettingLocked}>
              Orange
            </Button>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i).map(num => (
              <Button 
                  key={num}
                  variant='secondary'
                  size="circle"
                  className={cn("h-12 w-12 text-lg", numberToColor(num), selection.type === 'number' && selection.value === num && 'ring-2 ring-offset-2 ring-primary')}
                  onClick={() => handleSelection('number', num)}
                  disabled={isBettingLocked}>
                  {num}
              </Button>
            ))}
          </div>
          
          <div className="grid grid-cols-5 gap-2">
             {['Random', 'X1', 'X5', 'X10', 'X20', 'X50', 'X100', 'Big', 'Small'].map((item) => {
                 if(item.startsWith('X')) {
                    const m = parseInt(item.substring(1));
                    return <Button key={item} variant={multiplier === m ? 'default' : 'secondary'} onClick={() => handleMultiplier(m)} disabled={isBettingLocked}>{item}</Button>
                 }
                 if(item === 'Big' || item === 'Small') {
                    return <Button key={item} variant={selection.value === item.toLowerCase() ? 'default' : 'secondary'} className="col-span-2 h-12" onClick={() => handleSelection('size', item.toLowerCase())} disabled={isBettingLocked}>{item}</Button>
                 }
                 // Random button
                 return <Button key={item} variant='secondary' disabled={isBettingLocked}>Random</Button>
             })}
          </div>

        </CardContent>
      </Card>
    </section>
  );
}
