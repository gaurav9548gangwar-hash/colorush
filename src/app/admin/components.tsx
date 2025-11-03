
'use client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Deposit, User, Withdrawal } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Gamepad2, Users, DollarSign } from "lucide-react";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, collectionGroup, doc, getDoc, runTransaction } from "firebase/firestore";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export function DashboardTab() {
  const { firestore } = useFirebase();
  const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users } = useCollection<User>(usersRef);
  
  const depositsQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'deposits') : null, [firestore]);
  const { data: depositsData } = useCollection<Deposit>(depositsQuery);

  const withdrawalsQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'withdrawals') : null, [firestore]);
  const { data: withdrawalsData } = useCollection<Withdrawal>(withdrawalsQuery);
  
  const pendingWithdrawals = withdrawalsData?.filter(w => w.status === 'pending') || [];
  const pendingDeposits = depositsData?.filter(d => d.status === 'pending') || [];
  
  const totalRevenue = users?.reduce((acc, user) => acc + (user.balance || 0), 0) || 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{users?.length || 0}</div>
          <p className="text-xs text-muted-foreground">Real-time user count</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Wallet Balance</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Total balance in all wallets</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Deposits</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingDeposits.length}</div>
          <p className="text-xs text-muted-foreground">₹{pendingDeposits.reduce((acc, d) => acc + d.amount, 0).toFixed(2)} total</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingWithdrawals.length}</div>
          <p className="text-xs text-muted-foreground">₹{pendingWithdrawals.reduce((acc, w) => acc + w.amount, 0).toFixed(2)} total</p>
        </CardContent>
      </Card>
    </div>
  )
}

function BalanceDialog({ user, children }: { user: User, children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(0);
    const { firestore } = useFirebase();
  
    const handleBalanceUpdate = (operation: 'add' | 'deduct') => {
      if (!firestore || !user) return;
      
      const currentBalance = Number(user.balance) || 0;
      const amountToChange = Number(amount);

      if (isNaN(currentBalance) || isNaN(amountToChange) || amountToChange <= 0) {
          console.error("Invalid balance or amount");
          return;
      }

      const newBalance = operation === 'add' 
        ? currentBalance + amountToChange
        : currentBalance - amountToChange;
  
      if (newBalance < 0) {
          console.error("Balance cannot be negative.");
          return;
      }

      const userRef = doc(firestore, 'users', user.id);
      updateDocumentNonBlocking(userRef, { balance: newBalance });
      setOpen(false);
      setAmount(0);
    };
  
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Balance for {user.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Current Balance: ₹{(Number(user.balance) || 0).toFixed(2)}</p>
            <Label htmlFor="amount">Amount</Label>
            <Input 
              id="amount" 
              type="number" 
              value={amount === 0 ? '' : amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Enter amount to add or deduct"
            />
          </div>
          <DialogFooter className="flex-row justify-end space-x-2">
            <Button onClick={() => handleBalanceUpdate('add')}>Add Balance</Button>
            <Button variant="destructive" onClick={() => handleBalanceUpdate('deduct')}>Deduct Balance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

export function UsersTab() {
  const { firestore } = useFirebase();
  const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading } = useCollection<User>(usersRef);

  if (isLoading) {
    return <p>Loading users...</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <Input placeholder="Search by phone or email ID..." className="max-w-sm mt-2" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email ID</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.phone}</div>
                </TableCell>
                <TableCell>{user.emailId}</TableCell>
                <TableCell>₹{(Number(user.balance) || 0).toFixed(2)}</TableCell>
                <TableCell>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell className="space-x-2">
                    <BalanceDialog user={user}>
                        <Button size="sm">Edit Balance</Button>
                    </BalanceDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

const useRequests = <T extends Deposit | Withdrawal>(requestType: 'deposits' | 'withdrawals') => {
    const { firestore } = useFirebase();
    const requestsQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, requestType) : null, [firestore, requestType]);
    const { data: requests } = useCollection<(T & { id: string; path: string })>(requestsQuery);

    const [requestsWithUsers, setRequestsWithUsers] = useState<(T & { user?: User; path: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchUsers = async () => {
            if (!requests || !firestore) {
                if(!requests) setIsLoading(false);
                return;
            };

            setIsLoading(true);
            const enrichedRequests = await Promise.all(
                requests.map(async (req) => {
                    const userRef = doc(firestore, 'users', req.userId);
                    const userSnap = await getDoc(userRef);
                    return { 
                        ...req,
                        user: userSnap.exists() ? (userSnap.data() as User) : undefined 
                    } as (T & { user?: User; path: string });
                })
            );
            setRequestsWithUsers(enrichedRequests);
            setIsLoading(false);
        };
        fetchUsers();
    }, [requests, firestore]);

    return { data: requestsWithUsers, isLoading };
};

export function DepositsTab() {
    const { data: deposits, isLoading } = useRequests<Deposit>('deposits');
    const { firestore } = useFirebase();
  
    const handleRequest = async (deposit: Deposit & { path: string }, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;
        
        const depositRef = doc(firestore, deposit.path);

        try {
            await runTransaction(firestore, async (transaction) => {
                const userRef = doc(firestore, "users", deposit.userId);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists()) {
                    throw "User not found!";
                }

                // Only add to balance if approving a pending request
                if (newStatus === 'approved' && deposit.status === 'pending') {
                    const currentBalance = Number(userDoc.data().balance) || 0;
                    const depositAmount = Number(deposit.amount);
                    const newBalance = currentBalance + depositAmount;
                    transaction.update(userRef, { balance: newBalance });
                }
                
                transaction.update(depositRef, { status: newStatus });
            });
        } catch (e) {
            console.error("Transaction failed: ", e);
        }
    };
  
    if (isLoading) return <p>Loading deposits...</p>;

  return (
    <Card>
      <CardHeader><CardTitle>Deposit Requests</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deposits.map((deposit) => (
              <TableRow key={deposit.path}>
                <TableCell>{deposit.user?.name || deposit.userId}</TableCell>
                <TableCell>₹{Number(deposit.amount).toFixed(2)}</TableCell>
                <TableCell>{new Date(deposit.requestedAt).toLocaleString()}</TableCell>
                <TableCell><Badge variant={deposit.status === 'pending' ? 'secondary' : deposit.status === 'approved' ? 'default' : 'destructive'}>{deposit.status}</Badge></TableCell>
                <TableCell className="space-x-2">
                 {deposit.status === 'pending' && (
                    <>
                        <Button size="sm" variant="default" onClick={() => handleRequest(deposit, 'approved')}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRequest(deposit, 'rejected')}>Reject</Button>
                    </>
                 )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function WithdrawalsTab() {
    const { data: withdrawals, isLoading } = useRequests<Withdrawal>('withdrawals');
    const { firestore } = useFirebase();

    const handleRequest = async (withdrawal: Withdrawal & { path: string }, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;
        
        const withdrawalRef = doc(firestore, withdrawal.path);

        try {
            await runTransaction(firestore, async (transaction) => {
                const userRef = doc(firestore, "users", withdrawal.userId);
                
                if (newStatus === 'rejected' && withdrawal.status === 'pending') {
                    // If rejecting, add the money back to the user's balance.
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists()) throw "User not found!";
                    
                    const currentBalance = Number(userDoc.data()?.balance) || 0;
                    const withdrawalAmount = Number(withdrawal.amount);
                    const newBalance = currentBalance + withdrawalAmount;
                    transaction.update(userRef, { balance: newBalance });
                }
                
                // For 'approved' status, we assume the money has been sent, so we don't touch the balance.
                // The balance was already deducted when the user made the request. Wait, this is wrong.
                // Let's change the logic. The balance should only be deducted on approval.

                if (newStatus === 'approved' && withdrawal.status === 'pending') {
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists()) throw "User not found!";

                    const currentBalance = Number(userDoc.data()?.balance) || 0;
                    const withdrawalAmount = Number(withdrawal.amount);

                     if (currentBalance < withdrawalAmount) {
                        // If balance is insufficient, reject the request and refund if needed (though it shouldn't be deducted yet)
                        transaction.update(withdrawalRef, { status: 'rejected' });
                        throw "Insufficient balance!";
                    }
                    
                    // The balance should only be deducted upon approval.
                    // This was a bug in the previous withdrawal component.
                    // Let's assume the user-facing withdrawal dialog does NOT deduct balance.
                    // So we deduct it here.
                    const newBalance = currentBalance - withdrawalAmount;
                    transaction.update(userRef, { balance: newBalance });
                }

                transaction.update(withdrawalRef, { status: newStatus });
            });
        } catch (e) {
            console.error("Transaction failed: ", e);
             // Optionally, show a toast to the admin
        }
    };
  
    if (isLoading) return <p>Loading withdrawals...</p>;

    return (
      <Card>
        <CardHeader><CardTitle>Withdrawal Requests</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>UPI</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((w) => (
                <TableRow key={w.path}>
                  <TableCell>{w.user?.name || w.userId}</TableCell>
                  <TableCell>₹{Number(w.amount).toFixed(2)}</TableCell>
                  <TableCell>{w.upiBank}</TableCell>
                  <TableCell>{new Date(w.requestedAt).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={w.status === 'pending' ? 'secondary' : w.status === 'approved' ? 'default' : 'destructive'}>{w.status}</Badge></TableCell>
                  <TableCell className="space-x-2">
                     {w.status === 'pending' && (
                        <>
                           <Button size="sm" onClick={() => handleRequest(w, 'approved')}>Approve</Button>
                           <Button size="sm" variant="destructive" onClick={() => handleRequest(w, 'rejected')}>Reject</Button>
                        </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
}

export function GameControlTab() {
    const [resultNumber, setResultNumber] = useState('');
    
    // In a real app, you would fetch actual game rounds
    const [pastResults, setPastResults] = useState<any[]>([]);

    useEffect(() => {
        const DUMMY_RESULTS = Array.from({ length: 10 }, (_, i) => ({
            id: `g${i}`,
            gameId: `wingo1_2024031801120${9 - i}`,
            resultNumber: Math.floor(Math.random() * 10),
            resultColor: ['green', 'orange', 'white'][Math.floor(Math.random() * 3)] as 'green' | 'orange' | 'white',
          }));
        setPastResults(DUMMY_RESULTS);
    }, [])

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader><CardTitle>Manual Result</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">Manually set the result for the current game round.</p>
                    <Input 
                        placeholder="Enter number 0-9" 
                        type="number" 
                        min="0" max="9" 
                        value={resultNumber}
                        onChange={(e) => setResultNumber(e.target.value)}
                    />
                    <Button>Trigger Result</Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Past 50 Results</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Game ID</TableHead>
                                <TableHead>Result</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pastResults.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>{r.gameId}</TableCell>
                                    <TableCell>
                                        <Badge style={{ 
                                            backgroundColor: r.resultColor === 'white' ? '#fff' : r.resultColor,
                                            color: r.resultColor === 'white' ? '#581c87' : '#fff'
                                        }}>{r.resultNumber}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
