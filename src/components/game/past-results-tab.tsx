'use client'

import { useMemo } from 'react'
import { collection, query, orderBy, limit } from 'firebase/firestore'
import { useFirebase, useMemoFirebase } from '@/firebase'
import { useCollection } from '@/firebase/firestore/use-collection'
import type { GameResult } from '@/lib/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export function PastResultsTab() {
  const { firestore } = useFirebase()

  const resultsRef = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'game_rounds'), orderBy('endedAt', 'desc'), limit(20))
        : null,
    [firestore]
  )

  const { data: results, isLoading } = useCollection<GameResult>(resultsRef)

  if (isLoading) {
    return <p className="text-center py-4">Loading results...</p>
  }

  if (!results || results.length === 0) {
    return <p className="text-center py-4 text-muted-foreground">No results available yet.</p>
  }

  return (
    <ScrollArea className="h-72">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Round ID</TableHead>
            <TableHead>Number</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map(result => (
            <TableRow key={result.id}>
              <TableCell>{result.roundId.substring(0, 8)}...</TableCell>
              <TableCell>
                <Badge variant="secondary">{result.winningNumber}</Badge>
              </TableCell>
              <TableCell>
                <Badge className={`bg-${result.winningColor}-500 text-white`}>{result.winningColor}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{result.winningSize}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}
