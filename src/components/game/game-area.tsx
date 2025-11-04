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
import { useFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { GameResult } from "@/lib/types";
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
  const { user, firestore } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    // Generate dummy data on the client side to avoid hydration errors
    const DUMMY_RESULTS: GameResult[] = Array.from({ length: 10 }, (_, i) => ({
      id: `g${i}`,
      gameId: `wingo1_2024031801120${9 - i}`,
      resultNumber: Math.floor(Math.random() * 10),
      resultColor: ['green', 'orange', 'white'][Math.floor(Math.random() * 3)] as 'green' | 'orange' | 'white',
    }));
    setPastResults(DUMMY_RESULTS);
  }, []);

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
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "Please log in to place a bet." });
      return;
    }
    if (!isBetReady) {
       toast({ variant: "destructive", title: "Incomplete Selection", description: "Please select a color, number, size, and amount." });
       return;
    }

    try {
      const betsRef = collection(firestore, `users/${user.uid}/bets`);
      const betChoice = `color:${selection.color},number:${selection.number},size:${selection.size}`;

      await addDocumentNonBlocking(betsRef, {
        userId: user.uid,
        roundId: "wingo1_current_round", // This should be dynamic
        choice: betChoice,
        amount: betAmount,
        multiplier: 1, // This should be based on game rules
        won: false, // Will be updated later
        payout: 0,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Bet Placed!", description: `Your bet of ₹${betAmount} has been placed.` });
      // Reset selections
      setSelection({ color: null, number: null, size: null });
      setBetAmount(10);
    } catch (error) {
      console.error("Error placing bet:", error);
      toast({ variant: "destructive", title: "Failed to place bet." });
    }
  };

  return (
    <section className="space-y-4">
      {/* Countdown and Current Game Info */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-background/30">
        <div>
          <p className="text-sm text-gray-400">Win Go 1 Min</p>
          <p className="text-lg font-bold">20240318011210</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Time remaining</p>
          <CountdownTimer initialSeconds={60} />
        </div>
      </div>

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
