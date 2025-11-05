'use client'

import { useMemo } from 'react'
import { collection, query, where, limit } from 'firebase/firestore'
import { useFirebase, useMemoFirebase } from '@/firebase'
import { useCollection } from '@/firebase/firestore/use-collection'
import type { Bet } from '@/lib/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface MyBetsTabProps {
  userId: string
}

export function MyBetsTab({ userId }: MyBetsTabProps) {
  const { firestore } = useFirebase()

  const betsRef = useMemoFirebase(
    () =>
      firestore && userId
        ? query(
            collection(firestore, 'bets'),
            where('userId', '==', userId),
            limit(50)
          )
        : null,
    [firestore, userId]
  )

  const { data: bets, isLoading } = useCollection<Bet>(betsRef)

  const sortedBets = useMemo(() => {
    if (!bets) return []
    // Sort on the client-side to avoid complex Firestore indexes
    return bets.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
    });
  }, [bets]);

  const renderTarget = (bet: Bet) => {
    const baseClasses = "px-2 py-1 rounded-md text-xs font-bold text-white"
    switch (bet.type) {
      case 'color':
        return <Badge className={`${baseClasses} bg-${bet.target}-500`}>{String(bet.target)}</Badge>
      case 'number':
        return <Badge className={`${baseClasses} bg-gray-500`}>{String(bet.target)}</Badge>
      case 'size':
        return <Badge className={`${baseClasses} bg-blue-500`}>{String(bet.target)}</Badge>
      default:
        return String(bet.target)
    }
  }
  
  const renderStatus = (bet: Bet) => {
      switch(bet.status) {
          case 'win':
              return <span className='font-bold text-green-500'>+₹{bet.payout.toFixed(2)}</span>
          case 'loss':
              return <span className='font-bold text-destructive'>-₹{bet.amount.toFixed(2)}</span>
          case 'pending':
              return <span className='text-muted-foreground'>Waiting...</span>
      }
  }


  if (isLoading) {
    return <p className="text-center py-4">Loading your bets...</p>
  }

  if (!sortedBets || sortedBets.length === 0) {
    return <p className="text-center py-4 text-muted-foreground">You haven't placed any bets yet.</p>
  }

  return (
    <ScrollArea className="h-72">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Round</TableHead>
            <TableHead>Bet</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead className="text-right">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedBets.map(bet => (
            <TableRow key={bet.id}>
              <TableCell>{bet.roundId.substring(0, 5)}...</TableCell>
              <TableCell>{renderTarget(bet)}</TableCell>
              <TableCell>₹{bet.amount.toFixed(2)}</TableCell>
              <TableCell className="text-right">{renderStatus(bet)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}
