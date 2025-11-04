
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/game/header';
import { useFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
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

    let depositUnsubscribe: Unsubscribe | undefined;
    let withdrawalUnsubscribe: Unsubscribe | undefined;

    try {
      // Real-time listener for Deposits
      setIsLoadingDeposits(true);
      const depositQuery = query(collection(firestore, 'deposits'), where('userId', '==', user.uid));
      depositUnsubscribe = onSnapshot(depositQuery, (snapshot) => {
        const depositData = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Deposit));
        setDeposits(depositData.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
        setIsLoadingDeposits(false);
      }, (error) => {
        console.error("Failed to fetch deposits in real-time", error);
        setIsLoadingDeposits(false);
      });

      // Real-time listener for Withdrawals
      setIsLoadingWithdrawals(true);
      const withdrawalQuery = query(collection(firestore, 'withdrawals'), where('userId', '==', user.uid));
      withdrawalUnsubscribe = onSnapshot(withdrawalQuery, (snapshot) => {
        const withdrawalData = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Withdrawal));
        setWithdrawals(withdrawalData.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
        setIsLoadingWithdrawals(false);
      }, (error) => {
        console.error("Failed to fetch withdrawals in real-time", error);
        setIsLoadingWithdrawals(false);
      });

    } catch (e) {
        console.error("Error setting up history listeners", e);
        setIsLoadingDeposits(false);
        setIsLoadingWithdrawals(false);
    }
    
    // Cleanup listeners on component unmount
    return () => {
        if (depositUnsubscribe) {
            depositUnsubscribe();
        }
        if (withdrawalUnsubscribe) {
            withdrawalUnsubscribe();
        }
    };
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
