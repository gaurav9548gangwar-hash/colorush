
"use client";

import { useState, useEffect } from "react";
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
import { useFirebase, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, serverTimestamp, doc, updateDoc, query, orderBy, limit, getDoc, writeBatch, getDocs, where, collectionGroup, setDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { GameResult, User, Bet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";


type BetSelection = {
  type: 'color' | 'number' | null;
  value: string | number | null;
};

type PlacedBetInfo = {
    id: string;
    amount: number;
    choice: string;
    userId: string;
}

export default function GameArea() {
  const [selection, setSelection] = useState<BetSelection>({
    type: null,
    value: null,
  });
  const [betAmount, setBetAmount] = useState(10);
  const [betsThisRound, setBetsThisRound] = useState<PlacedBetInfo[]>([]);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showResultEmoji, setShowResultEmoji] = useState<'win' | 'loss' | null>(null);
  const [currentRoundId, setCurrentRoundId] = useState<string>(`round_${new Date().getTime()}`);
  const [isBettingLocked, setIsBettingLocked] = useState(false);

  const { user, firestore } = useFirebase();
  const { toast } = useToast();

  const userRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userData } = useDoc<User>(userRef);

  const gameRoundsRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'game_rounds'), orderBy('startTime', 'desc'), limit(10)) : null, [firestore]);
  const { data: pastResults } = useCollection<GameResult>(gameRoundsRef);
  
  const userBetsRef = useMemoFirebase(() => {
    if (!user || !firestore || !currentRoundId) return null;
    return query(collection(firestore, 'users', user.uid, 'bets'), orderBy('createdAt', 'desc'), limit(10));
  }, [user, firestore, currentRoundId]);
  const { data: userBets } = useCollection<Bet>(userBetsRef);

  const handleSelection = (type: 'color' | 'number', value: string | number) => {
    if(isBettingLocked) return;
    setSelection({ type, value });
  };

  const isBetReady = selection.type !== null && betAmount > 0;

  const handlePlaceBet = async () => {
    if (!user || !firestore || !userData) {
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
        // Optimistically update the user's balance locally for a faster UI response.
        // The server-side update will happen in handleRoundEnd.
        await updateDoc(userRef, { balance: newBalance });
      }

      const newBetRef = doc(collection(firestore, `users/${user.uid}/bets`));
      const betChoice = `${selection.type}:${selection.value}`;

      const betData: Omit<Bet, 'id'> = {
        userId: user.uid,
        roundId: currentRoundId,
        choice: betChoice,
        amount: betAmount,
        status: 'active',
        createdAt: Timestamp.now(), // Use client-side timestamp for immediate sorting
        payout: 0,
        won: false,
      };

      await setDoc(newBetRef, betData);
      
      setBetsThisRound(prev => [...prev, { id: newBetRef.id, amount: betAmount, choice: betChoice, userId: user.uid }]);

      toast({ title: "Bet Placed!", description: `INR ${betAmount} deducted from your wallet.` });
      setSelection({ type: null, value: null });
      setBetAmount(10);
    } catch (error: any) {
      console.error("Error placing bet:", error);
      toast({ variant: "destructive", title: "Failed to place bet.", description: error.message });
      // If the bet fails, revert the optimistic balance update
      if(userRef && userData) await updateDoc(userRef, { balance: userData.balance });
    }
  };
  
  const handleRoundEnd = async () => {
    if (!firestore || !currentRoundId) return;
    setIsBettingLocked(true); 

    const allUsersBetsQuery = query(
        collectionGroup(firestore, 'bets'),
        where('roundId', '==', currentRoundId),
        where('status', '==', 'active')
    );

    try {
        const allBetsSnapshot = await getDocs(allUsersBetsQuery);
        const allBetsInRound: PlacedBetInfo[] = [];
        allBetsSnapshot.forEach(doc => {
            const data = doc.data();
            allBetsInRound.push({
                id: doc.id,
                userId: data.userId,
                amount: data.amount,
                choice: data.choice,
            });
        });

        // --- Winning Logic ---
        let winningColor: 'green' | 'orange' | 'white';
        const colorTotals = { green: 0, orange: 0, white: 0 };
        
        const colorBets = allBetsInRound.filter(bet => bet.choice.startsWith('color:'));

        if (colorBets.length === 0) {
            // No color bets placed, pick a random color
            const colors: ('green' | 'orange' | 'white')[] = ['green', 'orange', 'white'];
            winningColor = colors[Math.floor(Math.random() * colors.length)];
        } else {
            colorBets.forEach(bet => {
                const betColor = bet.choice.split(':')[1] as keyof typeof colorTotals;
                if (betColor && colorTotals.hasOwnProperty(betColor)) {
                    colorTotals[betColor] += bet.amount;
                }
            });

            // Find the minimum bet amount among the colors
            const minBet = Math.min(...Object.values(colorTotals));
            // Find all colors that have this minimum bet amount
            const tiedColors = (Object.keys(colorTotals) as (keyof typeof colorTotals)[]).filter(
                color => colorTotals[color] === minBet
            );
            // Randomly select one of the tied colors as the winner
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
        
        // --- Payout Logic ---
        for (const bet of allBetsInRound) {
            const [betType, betValue] = bet.choice.split(':');
            const betDocRef = doc(firestore, 'users', bet.userId, 'bets', bet.id);
            let payout = 0;
            let didWin = false;

            if (betType === 'color' && betValue === winningColor) {
                payout = bet.amount * 2;
                didWin = true;
            } else if (betType === 'number' && Number(betValue) === winningNumber) {
                payout = bet.amount * 9;
                didWin = true;
            }

            if (didWin) {
                batch.update(betDocRef, { status: 'win', won: true, payout });
                // Accumulate payouts per user
                userPayouts[bet.userId] = (userPayouts[bet.userId] || 0) + payout;
            } else {
                batch.update(betDocRef, { status: 'loss', won: false, payout: 0 });
            }
        }
        
        // --- Update User Balances ---
        for (const userId in userPayouts) {
            const userToUpdateRef = doc(firestore, 'users', userId);
            const payoutAmount = userPayouts[userId];
            // We need to fetch the current balance to add to it safely
            const userDoc = await getDoc(userToUpdateRef);
            if(userDoc.exists()) {
                const currentBalance = userDoc.data().balance || 0;
                batch.update(userToUpdateRef, { balance: currentBalance + payoutAmount });
            }
        }
        
        // Save the final game round result
        const gameRoundRef = doc(firestore, 'game_rounds', currentRoundId);
        batch.set(gameRoundRef, resultData);

        await batch.commit();

        // --- Show UI feedback ---
        const currentUserBets = allBetsInRound.filter(b => b.userId === user?.uid);
        if (currentUserBets.length > 0) {
            const currentUserTotalPayout = userPayouts[user!.uid] || 0;
            if (currentUserTotalPayout > 0) {
                setShowResultEmoji('win');
                toast({ title: "You Won!", description: `INR ${currentUserTotalPayout.toFixed(2)} has been added to your wallet.` });
            } else {
                setShowResultEmoji('loss');
                toast({ title: "You Lost!", variant: 'destructive' });
            }
        }

    } catch(serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: `bets (collectionGroup)`,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: "destructive", title: "Error Calculating Results", description: "Could not fetch bet data. Check permissions." });
        console.error("Error in handleRoundEnd: ", serverError);
    }
  };
  
  const handleNewRound = () => {
    // This function gets called when the timer fully completes.
    // It prepares the UI for the next round.
    setBetsThisRound([]);
    setGameResult(null);
    setShowResultEmoji(null);
    setIsBettingLocked(false);
    setCurrentRoundId(`round_${new Date().getTime()}`);
  }

  return (
    <section className="space-y-4 relative">
      {showResultEmoji && (
         <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
            <p className="text-8xl animate-bounce">
                {showResultEmoji === 'win' ? '🎉' : '😢'}
            </p>
         </div>
      )}

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
                <TableHead>Round ID</TableHead>
                <TableHead>Choice</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userBets?.map((bet) => (
                <TableRow key={bet.id}>
                  <TableCell className="text-xs">{bet.roundId}</TableCell>
                  <TableCell className="text-xs capitalize">{bet.choice.replace(':', ': ')}</TableCell>
                  <TableCell>INR {bet.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={bet.status === 'win' ? 'default' : bet.status === 'loss' ? 'destructive' : 'secondary'}>
                          {bet.status}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-right text-green-400">
                      {bet.status === 'win' ? `+INR ${bet.payout.toFixed(2)}` : 'INR 0.00'}
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
              {pastResults?.map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="text-xs">{result.id}</TableCell>
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
