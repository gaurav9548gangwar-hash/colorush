'use client'

import { useEffect, useState, useCallback } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { useFirebase } from '@/firebase'
import type { Bet } from '@/lib/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface MyBetsTabProps {
  userId: string;
}

export function MyBetsTab({ userId }: MyBetsTabProps) {
  const { firestore } = useFirebase()
  const [bets, setBets] = useState<Bet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchBets = useCallback(async () => {
    if (!firestore || !userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    
    try {
      const betsQuery = query(
        collection(firestore, 'bets'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(betsQuery);
      const userBets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      setBets(userBets);
    } catch (err: any) {
      console.error("Error fetching bets: ", err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, userId]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

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
              return <span className='font-bold text-green-500'>+INR {bet.payout.toFixed(2)}</span>
          case 'loss':
              return <span className='font-bold text-destructive'>-INR {bet.amount.toFixed(2)}</span>
          case 'pending':
              return <span className='text-muted-foreground'>Waiting...</span>
      }
  }

  if (isLoading) {
    return <p className="text-center py-4">Loading your bets...</p>
  }
  
  if (error) {
    return <p className="text-center py-4 text-destructive">Error loading your bets. Check console.</p>
  }

  if (!bets || bets.length === 0) {
    return <p className="text-center py-4 text-muted-foreground">You haven't placed any bets yet.</p>
  }

  return (
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
          {bets.map(bet => (
            <TableRow key={bet.id}>
              <TableCell>{bet.roundId.substring(9, 13)}</TableCell>
              <TableCell>{renderTarget(bet)}</TableCell>
              <TableCell>INR {bet.amount.toFixed(2)}</TableCell>
              <TableCell className="text-right">{renderStatus(bet)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
  )
}
