
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/game/header';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Deposit, Withdrawal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function HistoryPage() {
  const { user, firestore, isUserLoading } = useFirebase();
  const router = useRouter();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(true);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(true);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchHistory = async () => {
      // Fetch Deposits
      setIsLoadingDeposits(true);
      const depositQuery = query(collection(firestore, 'deposits'), where('userId', '==', user.uid));
      try {
        const depositSnap = await getDocs(depositQuery);
        const depositData = depositSnap.docs.map(d => ({ ...d.data(), id: d.id } as Deposit));
        setDeposits(depositData.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
      } catch (e) {
          console.error("Failed to fetch deposits", e);
      } finally {
        setIsLoadingDeposits(false);
      }
      
      // Fetch Withdrawals
      setIsLoadingWithdrawals(true);
      const withdrawalQuery = query(collection(firestore, 'withdrawals'), where('userId', '==', user.uid));
      try {
          const withdrawalSnap = await getDocs(withdrawalQuery);
          const withdrawalData = withdrawalSnap.docs.map(d => ({ ...d.data(), id: d.id } as Withdrawal));
          setWithdrawals(withdrawalData.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
      } catch(e) {
          console.error("Failed to fetch withdrawals", e);
      } finally {
        setIsLoadingWithdrawals(false);
      }
    };

    fetchHistory();
  }, [firestore, user]);
  
  const getStatusBadgeVariant = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
        case 'approved': return 'default';
        case 'pending': return 'secondary';
        case 'rejected': return 'destructive';
        default: return 'outline';
    }
  }

  if (isUserLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">
        <p>Loading History...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Header />
      <main className="px-4 py-8 space-y-6">
        <h2 className="text-2xl font-bold text-center">Payment History</h2>
        <Tabs defaultValue="deposits" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>
          <TabsContent value="deposits">
            <Card className="bg-background/30">
              <CardHeader>
                <CardTitle>Deposit History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingDeposits ? (
                  <p>Loading deposits...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deposits?.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">₹{d.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(d.status)}>{d.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {new Date(d.requestedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="withdrawals">
             <Card className="bg-background/30">
              <CardHeader>
                <CardTitle>Withdrawal History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingWithdrawals ? (
                  <p>Loading withdrawals...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals?.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-medium">₹{w.amount.toFixed(2)}</TableCell>
                          <TableCell>
                             <Badge variant={getStatusBadgeVariant(w.status)}>{w.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {new Date(w.requestedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
