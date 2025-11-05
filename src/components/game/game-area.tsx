
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Input } from "../ui/input";
import CountdownTimer from "./countdown-timer";
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, updateDoc, query, orderBy, limit, getDoc, writeBatch, getDocs, where, Timestamp, addDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { GameResult, User, Bet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

type BetSelection = {
  type: 'color' | 'number' | null;
  value: string | number | null;
};

// Represents a bet fetched from Firestore for result calculation
type PlacedBetInfo = {
    id: string;
    userId: string;
    amount: number;
    choice: string;
}

export default function GameArea() {
  const [selection, setSelection] = useState<BetSelection>({ type: null, value: null });
  const [betAmount, setBetAmount] = useState(10);
  const [isBettingLocked, setIsBettingLocked] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
  
  const [pastResults, setPastResults] = useState<GameResult[]>([]);
  const [userBets, setUserBets] = useState<Bet[]>([]);

  const { user, firestore } = useFirebase();
  const { toast } = useToast();

  const userRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userData } = useDoc<User>(userRef);

  // Effect for initializing the first round
  useEffect(() => {
    setCurrentRoundId(`round_${new Date().getTime()}`);
  }, []);
  
  // Effect for fetching past game results
  useEffect(() => {
    if (!firestore) return;
    const gameRoundsQuery = query(collection(firestore, 'game_rounds'), orderBy('startTime', 'desc'), limit(10));
    const unsubscribe = onSnapshot(gameRoundsQuery, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as GameResult));
      setPastResults(results);
    });
    return () => unsubscribe();
  }, [firestore]);
  
  // Effect for fetching the current user's bets
  useEffect(() => {
    if (!firestore || !user) {
        setUserBets([]);
        return;
    };
    
    // This query is now safe and will not cause infinite loops.
    const userBetsQuery = query(collection(firestore, 'bets'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(userBetsQuery, (snapshot) => {
        const bets = snapshot.docs.map(doc => ({...doc.data(), id: doc.id} as Bet));
        setUserBets(bets);
    }, (error) => {
        console.error("Failed to fetch user bets in real-time", error);
        // We can optionally create and emit a FirestorePermissionError here
    });

    return () => unsubscribe();
  }, [firestore, user]);


  const handleSelection = (type: 'color' | 'number', value: string | number) => {
    if (isBettingLocked) return;
    setSelection({ type, value });
  };

  const isBetReady = selection.type !== null && betAmount > 0;

  const handlePlaceBet = async () => {
    if (!user || !firestore || !userData || !currentRoundId) {
      toast({ variant: "destructive", title: "Please log in to place a bet." });
      return;
    }
    if (isBettingLocked) {
      toast({ variant: "destructive", title: "Betting Locked", description: "You cannot place bets at this time." });
      return;
    }
    if (!selection.type || selection.value === null) {
       toast({ variant: "destructive", title: "Incomplete Selection", description: "Please select a color or number." });
       return;
    }
    if (userData.balance < betAmount) {
        toast({ variant: "destructive", title: "Insufficient Balance", description: "You don't have enough money to place this bet." });
        return;
    }

    try {
      const newBalance = userData.balance - betAmount;
      if (userRef) {
        // This is an optimistic update.
        await updateDoc(userRef, { balance: newBalance });
      }
      
      const newBetRef = collection(firestore, `bets`);
      const betChoice = `${selection.type}:${selection.value}`;

      const betData: Omit<Bet, 'id'> = {
        userId: user.uid,
        roundId: currentRoundId,
        choice: betChoice,
        amount: betAmount,
        status: 'active',
        createdAt: Timestamp.now(),
        payout: 0,
        won: false,
      };

      await addDoc(newBetRef, betData);

      toast({ title: "Bet Placed!", description: `INR ${betAmount} deducted from your wallet.` });
      setSelection({ type: null, value: null });
      
    } catch (error: any) {
      console.error("Error placing bet:", error);
      toast({ variant: "destructive", title: "Failed to place bet.", description: error.message });
      // If bet fails, revert the balance optimistically
      if (userRef && userData) {
        await updateDoc(userRef, { balance: userData.balance });
      }
    }
  };
  
  const handleRoundEnd = useCallback(async () => {
    if (!firestore || !currentRoundId) return;

    setIsBettingLocked(true);

    try {
        const allBetsInRoundQuery = query(
            collection(firestore, 'bets'),
            where('roundId', '==', currentRoundId),
            where('status', '==', 'active')
        );
        const allBetsSnapshot = await getDocs(allBetsInRoundQuery);
        const activeBetsData: PlacedBetInfo[] = allBetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlacedBetInfo));
        
        const colorTotals: { [color: string]: number } = { green: 0, orange: 0, white: 0 };
        activeBetsData.forEach(bet => {
            if (bet.choice.startsWith('color:')) {
                const color = bet.choice.split(':')[1];
                if (color in colorTotals) {
                    colorTotals[color] += bet.amount;
                }
            }
        });
        
        let winningColor: 'green' | 'orange' | 'white';
        if (activeBetsData.length === 0) {
            const colors: ('green' | 'orange' | 'white')[] = ['green', 'orange', 'white'];
            winningColor = colors[Math.floor(Math.random() * colors.length)];
        } else {
            const minBet = Math.min(...Object.values(colorTotals));
            const tiedColors = (Object.keys(colorTotals) as ('green' | 'orange' | 'white')[]).filter(
                color => colorTotals[color] === minBet
            );
            winningColor = tiedColors[Math.floor(Math.random() * tiedColors.length)];
        }
        
        const winningNumber = Math.floor(Math.random() * 10);
        
        const resultData: GameResult = {
            id: currentRoundId,
            gameId: currentRoundId,
            resultNumber: winningNumber,
            resultColor: winningColor,
            startTime: new Date().toISOString(),
            status: 'finished'
        };
        setGameResult(resultData);

        const batch = writeBatch(firestore);
        const userPayouts: { [userId: string]: number } = {};

        for (const bet of activeBetsData) {
            const betDocRef = doc(firestore, 'bets', bet.id);
            const [betType, betValue] = bet.choice.split(':');
            let didWin = false;
            let payout = 0;

            if (betType === 'color' && betValue === winningColor) {
                didWin = true;
                payout = bet.amount * 2;
            } else if (betType === 'number' && Number(betValue) === winningNumber) {
                didWin = true;
                payout = bet.amount * 9;
            }

            if (didWin) {
                batch.update(betDocRef, { status: 'win', won: true, payout: payout });
                userPayouts[bet.userId] = (userPayouts[bet.userId] || 0) + payout;
            } else {
                batch.update(betDocRef, { status: 'loss', won: false, payout: 0 });
            }
        }
        
        const gameRoundRef = doc(firestore, 'game_rounds', currentRoundId);
        batch.set(gameRoundRef, resultData);

        await batch.commit();

        // Update user balances in a separate, safer batch
        if (Object.keys(userPayouts).length > 0) {
            const userUpdatePromises = Object.keys(userPayouts).map(async (uid) => {
                const userToUpdateRef = doc(firestore, 'users', uid);
                const payoutAmount = userPayouts[uid];
                try {
                    const userDoc = await getDoc(userToUpdateRef);
                    if (userDoc.exists()) {
                        const currentBalance = userDoc.data().balance || 0;
                        await updateDoc(userToUpdateRef, { balance: currentBalance + payoutAmount });

                        if(user && uid === user.uid && payoutAmount > 0) {
                            toast({ title: "You Won!", description: `INR ${payoutAmount.toFixed(2)} has been added to your wallet.` });
                        }
                    }
                } catch (e) {
                    console.error(`Failed to update balance for user ${uid}:`, e);
                }
            });
            await Promise.allSettled(userUpdatePromises); // Prevents one failure from crashing all updates
        }

    } catch(serverError: any) {
        console.error("Error in handleRoundEnd: ", serverError);
        // This is a critical server-side error. Emitting a general error.
        const permissionError = new FirestorePermissionError({
            path: 'bets/game_rounds/users',
            operation: 'write',
            requestResourceData: { roundId: currentRoundId, message: "Failed during result calculation." }
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  }, [firestore, currentRoundId, user, toast]);
  
  const handleNewRound = useCallback(() => {
    setGameResult(null);
    setIsBettingLocked(false);
    setSelection({ type: null, value: null });
    setCurrentRoundId(`round_${new Date().getTime()}`);
  }, []);

  if (!currentRoundId) {
    return <div className="text-center p-8">Loading Game...</div>;
  }

  return (
    <section className="space-y-4 relative">
        <div className="flex items-center justify-between p-4 rounded-lg bg-background/30">
            <div>
            <p className="text-sm text-gray-400">Win Go 1 Min</p>
            <p className="text-lg font-bold">{currentRoundId}</p>
            </div>
            <div className="text-right">
            <CountdownTimer onRoundEnd={handleRoundEnd} onNewRound={handleNewRound} roundId={currentRoundId} />
            </div>
        </div>
      
      {gameResult && (
        <Card className="bg-primary/20 border-primary">
            <CardHeader className="text-center pb-2">
                <CardTitle>Result for {gameResult.id}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center gap-4">
                <p className="text-4xl font-bold">{gameResult.resultNumber}</p>
                <Badge className="text-2xl px-4 py-1" style={{ backgroundColor: gameResult.resultColor === 'white' ? 'white' : gameResult.resultColor, color: gameResult.resultColor === 'white' ? '#581c87' : '#fff' }}>
                    {gameResult.resultColor}
                </Badge>
            </CardContent>
        </Card>
      )}

      <Card className="bg-background/30 border-primary/50">
        <CardHeader>
          <CardTitle>Place Your Bet</CardTitle>
          <CardDescription>Select a color OR a number, and an amount.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base">1. Choose Color (2x Payout)</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={selection.type === 'color' && selection.value === 'green' ? 'default' : 'secondary'}
                className={cn("h-16 text-xl bg-green-500 hover:bg-green-600 text-white", selection.type === 'color' && selection.value === 'green' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('color', 'green')}
                disabled={isBettingLocked}
              >
                Green
              </Button>
              <Button
                variant={selection.type === 'color' && selection.value === 'white' ? 'default' : 'secondary'}
                className={cn("h-16 text-xl bg-gray-200 text-black hover:bg-gray-300", selection.type === 'color' && selection.value === 'white' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('color', 'white')}
                disabled={isBettingLocked}
              >
                White
              </Button>
              <Button
                variant={selection.type === 'color' && selection.value === 'orange' ? 'default' : 'secondary'}
                className={cn("h-16 text-xl bg-orange-500 hover:bg-orange-600 text-white", selection.type === 'color' && selection.value === 'orange' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('color', 'orange')}
                disabled={isBettingLocked}
              >
                Orange
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-base">OR Choose Number (9x Payout)</Label>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i).map(num => (
                <Button 
                    key={num}
                    variant={selection.type === 'number' && selection.value === num ? 'default' : 'secondary'}
                    className={cn("h-12 text-lg", selection.type === 'number' && selection.value === num && 'ring-2 ring-offset-2 ring-primary')}
                    onClick={() => handleSelection('number', num)}
                    disabled={isBettingLocked}
                >
                    {num}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
              <Label className="text-base">2. Choose Amount</Label>
               <RadioGroup
                defaultValue="10"
                className="grid grid-cols-5 gap-2"
                onValueChange={(value) => setBetAmount(Number(value))}
                value={String(betAmount)}
                disabled={isBettingLocked}
              >
                {[10, 50, 100, 500, 1000].map((val) => (
                  <div key={val} className="flex items-center space-x-2">
                    <RadioGroupItem value={String(val)} id={`r${val}`} />
                    <Label htmlFor={`r${val}`}>{val}</Label>
                  </div>
                ))}
              </RadioGroup>
              <Input 
                type="number" 
                value={betAmount} 
                onChange={(e) => setBetAmount(Number(e.target.value))} 
                placeholder="Or enter custom amount"
                className="mt-2 bg-input"
                disabled={isBettingLocked}
              />
          </div>

        </CardContent>
        <CardFooter>
            <Button className="w-full h-14 text-xl" disabled={!isBetReady || isBettingLocked} onClick={handlePlaceBet}>
                {isBettingLocked ? "Waiting for next round..." : "Place Bet"}
            </Button>
        </CardFooter>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg bg-background/30 p-4">
          <h3 className="font-bold mb-2 text-center">My Bets</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Round</TableHead>
                <TableHead>Choice</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userBets.map((bet) => (
                <TableRow key={bet.id}>
                  <TableCell className="text-xs truncate" style={{maxWidth: '80px'}}>{bet.roundId}</TableCell>
                  <TableCell className="text-xs capitalize">{bet.choice.replace(':', ': ')}</TableCell>
                  <TableCell>INR {bet.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={bet.won ? 'default' : bet.status === 'loss' ? 'destructive' : 'secondary'}>
                          {bet.status}
                      </Badge>
                  </TableCell>
                  <TableCell className={cn("text-right", bet.won ? "text-green-400" : "")}>
                      {bet.won ? `+INR ${bet.payout.toFixed(2)}` : 'INR 0.00'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg bg-background/30 p-4">
          <h3 className="font-bold mb-2 text-center">Past Results</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game ID</TableHead>
                <TableHead className="text-right">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastResults.map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="text-xs truncate" style={{maxWidth: '120px'}}>{result.id}</TableCell>
                  <TableCell className="text-right">
                    <Badge className="text-lg" style={{ backgroundColor: result.resultColor === 'white' ? 'white' : result.resultColor, color: result.resultColor === 'white' ? '#581c87' : '#fff' }}>
                      {result.resultNumber}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

    