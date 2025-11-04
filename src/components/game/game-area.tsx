
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
import { useFirebase, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { collection, serverTimestamp, doc, updateDoc, query, orderBy, limit, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { GameResult, User, Bet } from "@/lib/types";
import { cn } from "@/lib/utils";

type BetSelection = {
  color: "green" | "white" | "orange" | null;
  number: number | null;
  size: "big" | "small" | null;
};

export default function GameArea() {
  const [selection, setSelection] = useState<BetSelection>({
    color: null,
    number: null,
    size: null,
  });
  const [betAmount, setBetAmount] = useState(10);
  const [currentBet, setCurrentBet] = useState<{ id: string, amount: number; color: string; choice: string; } | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showResultEmoji, setShowResultEmoji] = useState<'win' | 'loss' | null>(null);
  const [currentRoundId, setCurrentRoundId] = useState<string>('');

  const { user, firestore } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    // Generate the round ID on the client side to avoid hydration mismatch
    setCurrentRoundId(`round_${new Date().getTime()}`);
  }, []);

  const userRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userData } = useDoc<User>(userRef);

  // Live Past Game Results
  const gameRoundsRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'game_rounds'), orderBy('startTime', 'desc'), limit(10)) : null, [firestore]);
  const { data: pastResults } = useCollection<GameResult>(gameRoundsRef);
  
  // Live User Bets
  const userBetsRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'bets'), orderBy('createdAt', 'desc'), limit(10));
  }, [user, firestore]);
  const { data: userBets } = useCollection<Bet>(userBetsRef);

  const handleSelection = (type: keyof BetSelection, value: any) => {
    setSelection(prev => ({ ...prev, [type]: value }));
  };

  const isBetReady = selection.color !== null && betAmount > 0 && selection.number !== null && selection.size !== null;

  const handlePlaceBet = async () => {
    if (!user || !firestore || !userData) {
      toast({ variant: "destructive", title: "Please log in to place a bet." });
      return;
    }
    if (!isBetReady) {
       toast({ variant: "destructive", title: "Incomplete Selection", description: "Please select a color, number, and size." });
       return;
    }
    if (userData.balance < betAmount) {
        toast({ variant: "destructive", title: "Insufficient Balance", description: "You don't have enough money to place this bet." });
        return;
    }

    try {
      // 1. Deduct bet amount immediately
      const newBalance = userData.balance - betAmount;
      if (userRef) {
        await updateDoc(userRef, { balance: newBalance });
      }

      // 2. Create a new bet document in Firestore
      const betsRef = collection(firestore, 'users', user.uid, 'bets');
      const betChoice = `color:${selection.color},number:${selection.number},size:${selection.size}`;
      const newBetRef = doc(collection(firestore, `users/${user.uid}/bets`));

      const betData = {
        userId: user.uid,
        roundId: currentRoundId,
        choice: betChoice,
        amount: betAmount,
        status: 'pending',
        createdAt: serverTimestamp(),
        payout: 0,
        won: false,
      };

      setDocumentNonBlocking(newBetRef, betData, {});
      
      // 3. Store current bet to check for win/loss later
      setCurrentBet({ id: newBetRef.id, amount: betAmount, color: selection.color!, choice: betChoice });

      toast({ title: "Bet Placed!", description: `₹${betAmount} deducted from your wallet.` });
      // 4. Reset selections for next round
      setSelection({ color: null, number: null, size: null });
      setBetAmount(10);
    } catch (error: any) {
      console.error("Error placing bet:", error);
      toast({ variant: "destructive", title: "Failed to place bet.", description: error.message });
      // Revert balance if bet placement fails
      if(userRef) await updateDoc(userRef, { balance: userData.balance });
    }
  };
  
  const handleRoundEnd = async (result: GameResult) => {
    setGameResult(result);
    if (!firestore) return;

    // Save the game round result to Firestore
    // addDocumentNonBlocking(collection(firestore, 'game_rounds'), { ...result, startTime: new Date().toISOString(), status: 'finished' });

    if (currentBet && user && firestore && userData && userRef) {
      const betDocRef = doc(firestore, 'users', user.uid, 'bets', currentBet.id);
      
      // Determine win condition based on the placed bet
      const choiceParts = currentBet.choice.split(',');
      const betColor = choiceParts.find(p => p.startsWith('color:'))?.split(':')[1];
      
      let isWin = false;
      if (betColor === result.resultColor) {
        isWin = true;
      }
      
      if (isWin) {
        // WIN
        setShowResultEmoji('win');
        const winnings = currentBet.amount * 2; // Simple double for color match
        
        // Re-fetch user data to avoid race conditions
        const updatedUserResponse = await getDoc(userRef);
        const updatedUserData = updatedUserResponse.data() as User;
        
        const newBalance = updatedUserData.balance + winnings;

        await updateDoc(userRef, { balance: newBalance });
        await updateDoc(betDocRef, { status: 'win', won: true, payout: winnings });
        toast({ title: "You Won!", description: `₹${winnings.toFixed(2)} has been added to your wallet.`});
      } else {
        // LOSS
        setShowResultEmoji('loss');
        await updateDoc(betDocRef, { status: 'loss', won: false, payout: 0 });
        toast({ title: "You Lost!", variant: 'destructive'});
      }
    }
    
    // The emoji will be shown for 5 seconds
    setTimeout(() => {
        setShowResultEmoji(null);
    }, 5000);
  };
  
  const handleNewRound = () => {
    setCurrentBet(null);
    setGameResult(null);
    setShowResultEmoji(null);
    setCurrentRoundId(`round_${new Date().getTime()}`);
  }

  return (
    <section className="space-y-4 relative">
      {/* Win/Loss Emoji Overlay */}
      {showResultEmoji && (
         <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <p className="text-8xl animate-bounce">
                {showResultEmoji === 'win' ? '🎉' : '😢'}
            </p>
         </div>
      )}


      {/* Countdown and Current Game Info */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-background/30">
        <div>
          <p className="text-sm text-gray-400">Win Go 1 Min</p>
          <p className="text-lg font-bold">{currentRoundId}</p>
        </div>
        <div className="text-right">
          <CountdownTimer onRoundEnd={handleRoundEnd} onNewRound={handleNewRound} roundId={currentRoundId} />
        </div>
      </div>
      
       {/* Result Display */}
      {gameResult && (
        <Card className="bg-primary/20 border-primary">
            <CardHeader className="text-center pb-2">
                <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center gap-4">
                <p className="text-2xl font-bold">{gameResult.resultNumber}</p>
                <Badge className="text-lg" style={{ backgroundColor: gameResult.resultColor === 'white' ? 'white' : gameResult.resultColor, color: gameResult.resultColor === 'white' ? '#581c87' : '#fff' }}>
                    {gameResult.resultColor}
                </Badge>
            </CardContent>
        </Card>
      )}


      {/* Betting UI */}
      <Card className="bg-background/30 border-primary/50">
        <CardHeader>
          <CardTitle>Place Your Bet</CardTitle>
          <CardDescription>Follow the steps to place your bet for the next round.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Color */}
          <div className="space-y-2">
            <Label className="text-base">1. Choose Color</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={selection.color === 'green' ? 'default' : 'secondary'}
                className={cn("h-16 text-xl", selection.color === 'green' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('color', 'green')}
              >
                Green
              </Button>
              <Button
                variant={selection.color === 'white' ? 'default' : 'secondary'}
                className={cn("h-16 text-xl bg-gray-200 text-black hover:bg-gray-300", selection.color === 'white' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('color', 'white')}
              >
                White
              </Button>
              <Button
                variant={selection.color === 'orange' ? 'default' : 'secondary'}
                className={cn("h-16 text-xl bg-orange-500 hover:bg-orange-600", selection.color === 'orange' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('color', 'orange')}
              >
                Orange
              </Button>
            </div>
          </div>

          {/* Step 2: Number */}
           <div className="space-y-2">
            <Label className="text-base">2. Choose Number</Label>
             <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, i) => {
                    return (
                        <Button
                            key={i}
                            size="circle"
                            variant={selection.number === i ? 'default' : 'secondary'}
                            className={cn('h-12 w-12 text-xl font-bold', selection.number === i && 'ring-2 ring-offset-2 ring-primary')}
                            onClick={() => handleSelection('number', i)}
                        >
                            {i}
                        </Button>
                    );
                })}
            </div>
          </div>

          {/* Step 3: Size */}
          <div className="space-y-2">
            <Label className="text-base">3. Choose Size</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={selection.size === 'small' ? 'default' : 'secondary'}
                className={cn("h-14 text-xl", selection.size === 'small' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('size', 'small')}
              >
                Small
              </Button>
              <Button
                variant={selection.size === 'big' ? 'default' : 'secondary'}
                className={cn("h-14 text-xl", selection.size === 'big' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('size', 'big')}
              >
                Big
              </Button>
            </div>
          </div>
          
          {/* Step 4: Amount */}
          <div className="space-y-2">
              <Label className="text-base">4. Choose Amount</Label>
               <RadioGroup
                defaultValue="10"
                className="grid grid-cols-4 gap-2"
                onValueChange={(value) => setBetAmount(Number(value))}
                value={String(betAmount)}
              >
                {[10, 50, 100, 500].map((val) => (
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
              />
          </div>

        </CardContent>
        <CardFooter>
            <Button className="w-full h-14 text-xl" disabled={!isBetReady} onClick={handlePlaceBet}>
                Place Bet
            </Button>
        </CardFooter>
      </Card>


      {/* My Bets History */}
      <div className="rounded-lg bg-background/30 p-4">
        <h3 className="font-bold mb-2">My Bets</h3>
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
                <TableCell className="text-xs">{bet.choice}</TableCell>
                <TableCell>₹{bet.amount.toFixed(2)}</TableCell>
                <TableCell>
                   <Badge variant={bet.status === 'win' ? 'default' : bet.status === 'loss' ? 'destructive' : 'secondary'}>
                        {bet.status}
                    </Badge>
                </TableCell>
                <TableCell className="text-right text-green-400">
                    {bet.status === 'win' ? `+₹${bet.payout.toFixed(2)}` : '₹0.00'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>


      {/* Past Results */}
      <div className="rounded-lg bg-background/30 p-4">
        <h3 className="font-bold mb-2">Past Results</h3>
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

    </section>
  );

    