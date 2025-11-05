"use client";

import { useMemo } from "react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import type { GameResult } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";

export default function GameHistoryTab() {
  const { firestore } = useFirebase();

  const resultsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, "game_rounds"), orderBy("startTime", "desc"), limit(20))
        : null,
    [firestore]
  );
  const { data: pastResults, isLoading, error } = useCollection<GameResult>(resultsQuery);
  
  const numberToColor = (num: number) => {
    if ([1, 3, 7, 9].includes(num)) return 'text-green-500';
    if ([2, 4, 6, 8].includes(num)) return 'text-orange-500';
    if ([0, 5].includes(num)) return 'text-purple-500';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <h3 className="font-bold">Win Go 1 Min Record</h3>
            <Button variant="ghost" size="icon" disabled={isLoading}><RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /></Button>
        </div>
        {isLoading && <p className="text-center">Loading history...</p>}
        {error && <p className="text-center text-destructive">Error loading history.</p>}
        {pastResults && (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Color</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pastResults.map(r => (
                        <TableRow key={r.id}>
                            <TableCell>{r.gameId.slice(-6)}</TableCell>
                            <TableCell className={cn("font-bold", numberToColor(r.resultNumber))}>{r.resultNumber}</TableCell>
                            <TableCell>
                                <Badge variant={r.resultSize === 'big' ? 'destructive' : 'secondary'}>{r.resultSize}</Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                    <div className={cn("w-3 h-3 rounded-full",
                                        r.resultColor === 'green' && 'bg-green-500',
                                        r.resultColor === 'orange' && 'bg-orange-500',
                                        r.resultColor === 'white' && 'bg-white'
                                    )} />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )}
    </div>
  );
}