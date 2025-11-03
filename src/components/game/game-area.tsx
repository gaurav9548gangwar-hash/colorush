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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Input } from "../ui/input";
import CountdownTimer from "./countdown-timer";
import { useFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { GameResult } from "@/lib/types";

type BetChoice = {
  type: "color" | "number" | "size";
  value: string | number;
};

export default function GameArea() {
  const [betChoice, setBetChoice] = useState<BetChoice | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [isBetDialogOpen, setIsBetDialogOpen] = useState(false);
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

  const openBetDialog = (choice: BetChoice) => {
    setBetChoice(choice);
    setIsBetDialogOpen(true);
  };

  const handlePlaceBet = async () => {
    if (!user || !firestore || !betChoice) {
      toast({ variant: "destructive", title: "Please log in to place a bet." });
      return;
    }
    if (betAmount <= 0) {
      toast({ variant: "destructive", title: "Invalid bet amount." });
      return;
    }

    try {
      const betsRef = collection(firestore, `users/${user.uid}/bets`);
      await addDocumentNonBlocking(betsRef, {
        userId: user.uid,
        roundId: "wingo1_current_round", // This should be dynamic
        choice: `${betChoice.type}:${betChoice.value}`,
        amount: betAmount,
        multiplier: 1, // This should be based on game rules
        won: false, // Will be updated later
        payout: 0,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Bet Placed!", description: `You bet ₹${betAmount} on ${betChoice.value}` });
      setIsBetDialogOpen(false);
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

      {/* Betting Options */}
      <div className="space-y-4">
        {/* Color Bets */}
        <div className="grid grid-cols-3 gap-4">
          <Button variant="green" className="h-20 text-2xl" onClick={() => openBetDialog({ type: 'color', value: 'green' })}>
            Green
          </Button>
          <Button variant="white" className="h-20 text-2xl" onClick={() => openBetDialog({ type: 'color', value: 'white' })}>
            White
          </Button>
          <Button variant="orange" className="h-20 text-2xl" onClick={() => openBetDialog({ type: 'color', value: 'orange' })}>
            Orange
          </Button>
        </div>

        {/* Number Bets */}
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
                    className={`h-12 w-12 text-xl font-bold ${colorClass}`}
                    onClick={() => openBetDialog({ type: 'number', value: i })}
                >
                    {i}
                </Button>
            );
        })}
        </div>

        {/* Size Bets */}
        <div className="grid grid-cols-2 gap-4">
            <Button variant="secondary" className="h-16 text-xl" onClick={() => openBetDialog({ type: 'size', value: 'small' })}>Small</Button>
            <Button variant="secondary" className="h-16 text-xl" onClick={() => openBetDialog({ type: 'size', value: 'big' })}>Big</Button>
        </div>
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

       {/* Bet Confirmation Dialog */}
       <Dialog open={isBetDialogOpen} onOpenChange={setIsBetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Bet on {betChoice?.value}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Amount</Label>
            <RadioGroup
              defaultValue="10"
              className="grid grid-cols-4 gap-2"
              onValueChange={(value) => setBetAmount(Number(value))}
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
              placeholder="Or enter amount"
            />
          </div>
          <DialogFooter>
            <Button onClick={handlePlaceBet}>Confirm Bet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
