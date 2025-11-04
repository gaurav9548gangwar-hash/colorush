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
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import { collection, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { GameResult, User } from "@/lib/types";
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
  const [pastResults, setPastResults] = useState<GameResult[]>([]);
  const [currentBet, setCurrentBet] = useState<{ amount: number; color: string } | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showResultEmoji, setShowResultEmoji] = useState<'win' | 'loss' | null>(null);

  const { user, firestore } = useFirebase();
  const { toast } = useToast();

  const userRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userData } = useDoc<User>(userRef);


  // Add new results to the top
  const addResult = (result: GameResult) => {
    setPastResults(prev => [result, ...prev.slice(0, 9)]);
  };
  
  useEffect(() => {
    // Generate dummy data on the client side to avoid hydration errors
    if (pastResults.length === 0) {
      const DUMMY_RESULTS: GameResult[] = Array.from({ length: 10 }, (_, i) => ({
        id: `g${i}`,
        gameId: `wingo1_2024031801120${9 - i}`,
        resultNumber: Math.floor(Math.random() * 10),
        resultColor: ['green', 'orange', 'white'][Math.floor(Math.random() * 3)] as 'green' | 'orange' | 'white',
      }));
      setPastResults(DUMMY_RESULTS);
    }
  }, [pastResults.length]);

  const handleSelection = <K extends keyof BetSelection>(
    type: K,
    value: BetSelection[K]
  ) => {
    setSelection((prev) => ({
      ...prev,
      [type]: prev[type] === value ? null : value, // Toggle selection
    }));
  };
  
  const isBetReady = selection.color !== null && selection.number !== null && selection.size !== null && betAmount > 0;

  const handlePlaceBet = async () => {
    if (!user || !firestore || !userData) {
      toast({ variant: "destructive", title: "Please log in to place a bet." });
      return;
    }
    if (!isBetReady) {
       toast({ variant: "destructive", title: "Incomplete Selection", description: "Please select a color, number, size, and amount." });
       return;
    }
    if (userData.balance < betAmount) {
        toast({ variant: "destructive", title: "Insufficient Balance", description: "You don't have enough money to place this bet." });
        return;
    }

    try {
      // Deduct bet amount immediately
      const newBalance = userData.balance - betAmount;
      await updateDoc(userRef!, { balance: newBalance });

      // Store current bet to check for win/loss later
      setCurrentBet({ amount: betAmount, color: selection.color! });

      toast({ title: "Bet Placed!", description: `₹${betAmount} deducted from your wallet.` });
      // Reset selections for next round
      setSelection({ color: null, number: null, size: null });
      setBetAmount(10);
    } catch (error: any) {
      console.error("Error placing bet:", error);
      toast({ variant: "destructive", title: "Failed to place bet.", description: error.message });
    }
  };
  
  const handleRoundEnd = async (result: GameResult) => {
    setGameResult(result);
    addResult(result);

    if (currentBet && user && firestore) {
      if (currentBet.color === result.resultColor) {
        // WIN
        setShowResultEmoji('win');
        const winnings = currentBet.amount * 2;
        const userDocRef = doc(firestore, 'users', user.uid);
        // We need the most recent balance, so we can't use the stale `userData`
        const currentBalance = (await (await fetch(userDocRef.path).then(res => res.json())).data() as User)?.balance ?? 0;
        const newBalance = (userData?.balance || 0) + winnings;
        await updateDoc(userDocRef, { balance: newBalance });
        toast({ title: "You Won!", description: `₹${winnings} has been added to your wallet.`});
      } else {
        // LOSS
        setShowResultEmoji('loss');
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
          <p className="text-lg font-bold">20240318011210</p>
        </div>
        <div className="text-right">
          <CountdownTimer onRoundEnd={handleRoundEnd} onNewRound={handleNewRound} />
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
                variant={selection.color === 'green' ? 'default' : 'green'}
                className={cn("h-16 text-xl", selection.color === 'green' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('color', 'green')}
              >
                Green
              </Button>
              <Button
                variant={selection.color === 'white' ? 'default' : 'white'}
                className={cn("h-16 text-xl", selection.color === 'white' && 'ring-2 ring-offset-2 ring-primary')}
                onClick={() => handleSelection('color', 'white')}
              >
                White
              </Button>
              <Button
                variant={selection.color === 'orange' ? 'default' : 'orange'}
                className={cn("h-16 text-xl", selection.color === 'orange' && 'ring-2 ring-offset-2 ring-primary')}
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
                    const colors = ["orange", "green", "orange", "green", "orange", "green", "orange", "green", "orange", "green"];
                    const isWhite = i === 0 || i === 5;
                    let colorClass = '';
                    if (isWhite) {
                        colorClass = 'bg-white text-purple-700 border-2 border-purple-500 hover:bg-gray-100 shadow-[0_0_10px_theme(colors.purple.400)]';
                    } else if (colors[i] === 'green') {
                        colorClass = 'bg-green-500 text-white hover:bg-green-600';
                    } else {
                        colorClass = 'bg-orange-500 text-white hover:bg-orange-600';
                    }
                    
                    return (
                        <Button
                            key={i}
                            size="circle"
                            className={cn('h-12 w-12 text-xl font-bold', colorClass, selection.number === i && 'ring-2 ring-offset-2 ring-primary')}
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
                {[10, 20, 30, 40].map((val) => (
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
                className="mt-2"
              />
          </div>

        </CardContent>
        <CardFooter>
            <Button className="w-full h-14 text-xl" disabled={!isBetReady} onClick={handlePlaceBet}>
                Place Bet
            </Button>
        </CardFooter>
      </Card>


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
            {pastResults.map((result) => (
              <TableRow key={result.id}>
                <TableCell>{result.gameId}</TableCell>
                <TableCell className="text-right">
                  <Badge style={{ backgroundColor: result.resultColor === 'white' ? 'white' : result.resultColor, color: result.resultColor === 'white' ? '#581c87' : '#fff' }}>
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
}
