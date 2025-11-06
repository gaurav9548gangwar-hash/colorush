'use client'

import { useMemo, useEffect } from 'react'
import { collection, query, where, type Timestamp } from 'firebase/firestore'
import { useFirebase, useMemoFirebase } from '@/firebase'
import { useCollection } from '@/firebase/firestore/use-collection'
import type { DepositRequest, WithdrawalRequest } from '@/lib/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/game/header'

const formatDate = (timestamp: Timestamp | Date | string | undefined) => {
    if (!timestamp) return 'N/A';
    const date = (timestamp as Timestamp)?.toDate ? (timestamp as Timestamp).toDate() : new Date(timestamp as any);
    return date.toLocaleString();
}

function DepositHistoryTab({ userId }: { userId: string }) {
    const { firestore } = useFirebase()
    const depositsRef = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'deposits'), where('userId', '==', userId)) : null,
        [firestore, userId]
    )
    const { data: deposits, isLoading, error } = useCollection<DepositRequest>(depositsRef)

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <Badge variant="default" className="bg-green-500">Approved</Badge>
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>
            default: return <Badge variant="secondary">Pending</Badge>
        }
    }

    const sortedDeposits = useMemo(() => {
        if (!deposits) return [];
        return [...deposits].sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateB - dateA;
        });
    }, [deposits]);


    if (isLoading) return <p className="text-center py-4">Loading deposit history...</p>
    if (error) return <p className="text-center text-destructive py-4">Error loading history. Please check permissions.</p>
    if (!sortedDeposits || sortedDeposits.length === 0) return <p className="text-center py-4 text-muted-foreground">No deposit history found.</p>

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Date</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedDeposits.map(req => (
                    <TableRow key={req.id}>
                        <TableCell>INR {req.amount.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell>{req.transactionId}</TableCell>
                        <TableCell>{formatDate(req.createdAt)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

function WithdrawalHistoryTab({ userId }: { userId: string }) {
    const { firestore } = useFirebase()
    const withdrawalsRef = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'withdrawals'), where('userId', '==', userId)) : null,
        [firestore, userId]
    )
    const { data: withdrawals, isLoading, error } = useCollection<WithdrawalRequest>(withdrawalsRef)

     const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <Badge variant="default" className="bg-green-500">Approved</Badge>
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>
            default: return <Badge variant="secondary">Pending</Badge>
        }
    }

    const sortedWithdrawals = useMemo(() => {
        if (!withdrawals) return [];
        return [...withdrawals].sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateB - dateA;
        });
    }, [withdrawals]);


    if (isLoading) return <p className="text-center py-4">Loading withdrawal history...</p>
    if (error) return <p className="text-center text-destructive py-4">Error loading history. Please check permissions.</p>
    if (!sortedWithdrawals || sortedWithdrawals.length === 0) return <p className="text-center py-4 text-muted-foreground">No withdrawal history found.</p>

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>UPI ID</TableHead>
                    <TableHead>Date</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedWithdrawals.map(req => (
                    <TableRow key={req.id}>
                        <TableCell>INR {req.amount.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell>{req.upiId}</TableCell>
                        <TableCell>{formatDate(req.createdAt)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}


export default function WalletHistoryPage() {
    const { user, isUserLoading } = useFirebase()
    const router = useRouter()

     useEffect(() => {
      if (!isUserLoading && !user) {
        router.replace('/login')
      }
    }, [isUserLoading, user, router])


    if (isUserLoading || !user) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>
    }

    return (
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-6">
                <Card>
                    <CardHeader>
                        <div className="relative flex items-center justify-center">
                             <Button variant="ghost" size="icon" className="absolute left-0" onClick={() => router.back()}>
                                <ArrowLeft />
                            </Button>
                            <CardTitle>Payment History</CardTitle>
                        </div>
                        <CardDescription className="text-center">View your deposit and withdrawal history.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="deposits">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="deposits">Deposit History</TabsTrigger>
                                <TabsTrigger value="withdrawals">Withdrawal History</TabsTrigger>
                            </TabsList>
                            <TabsContent value="deposits" className="mt-4">
                                <DepositHistoryTab userId={user.uid} />
                            </TabsContent>
                            <TabsContent value="withdrawals" className="mt-4">
                                <WithdrawalHistoryTab userId={user.uid} />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
