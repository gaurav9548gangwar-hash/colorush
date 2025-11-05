"use client";

import { useMemo } from "react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import type { Bet } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export default function MyBetsTab() {
  const { firestore, user } = useFirebase();

  const betsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, "bets"), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(20))
        : null,
    [firestore, user]
  );
  const { data: myBets, isLoading, error } = useCollection<Bet>(betsQuery);

  const getStatusVariant = (status: 'active' | 'win' | 'loss') => {
      switch(status) {
          case 'win': return 'default';
          case 'loss': return 'destructive';
          case 'active': return 'secondary';
      }
  }

  return (
    <div className="space-y-2">
         <div className="flex justify-between items-center">
            <h3 className="font-bold">My Bet History</h3>
            <Button variant="ghost" size="icon" disabled={isLoading}><RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /></Button>
        </div>
        {isLoading && <p className="text-center">Loading bets...</p>}
        {error && <p className="text-center text-destructive">Error loading bets.</p>}
        {myBets && (
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Select</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Result</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {myBets.map(bet => (
                        <TableRow key={bet.id}>
                            <TableCell>{bet.roundId.slice(-6)}</TableCell>
                            <TableCell>
                                <Badge variant={getStatusVariant(bet.status)}>{bet.choice}</Badge>
                            </TableCell>
                            <TableCell>₹{bet.amount.toFixed(2)}</TableCell>
                            <TableCell className={bet.won ? 'text-green-500' : 'text-red-500'}>
                                {bet.status === 'active' ? 'Waiting...' : `₹${bet.payout.toFixed(2)}`}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )}
    </div>
  );
}