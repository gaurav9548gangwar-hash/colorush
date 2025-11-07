'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
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

  useEffect(() => {
    // This function will be called when the component mounts
    const fetchBets = async () => {
      // Ensure we have what we need before proceeding
      if (!firestore || !userId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // 1. Create a simple query to get bets only for the current user.
        // NO 'orderBy' here to avoid needing a composite index in Firestore.
        const betsQuery = query(
          collection(firestore, 'bets'),
          where('userId', '==', userId)
        );
        
        // 2. Fetch the documents from Firestore.
        const querySnapshot = await getDocs(betsQuery);
        const userBets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
        
        // 3. Sort the bets on the client-side (in the browser) by date.
        // This is reliable and avoids Firestore errors.
        const sortedBets = userBets.sort((a, b) => {
           // Handle both Firestore Timestamps and regular Date objects
           const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
           const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
           return dateB - dateA; // Sort from newest to oldest
        });

        setBets(sortedBets);

      } catch (err: any) {
        console.error("Error fetching bets: ", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBets();
    
  // This useEffect will run only when firestore or userId changes.
  }, [firestore, userId]);

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
