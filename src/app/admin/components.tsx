
'use client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Deposit, GameResult, User, Withdrawal } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Gamepad2, Users, DollarSign } from "lucide-react";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, collectionGroup, doc, getDoc, runTransaction } from "firebase/firestore";
import { useFirebase, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const DUMMY_RESULTS: GameResult[] = Array.from({ length: 10 }, (_, i) => ({
  id: `g${i}`,
  gameId: `wingo1_2024031801120${9 - i}`,
  resultNumber: Math.floor(Math.random() * 10),
  resultColor: ['green', 'orange', 'white'][Math.floor(Math.random() * 3)] as 'green' | 'orange' | 'white',
}));


export function DashboardTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1,234</div>
          <p className="text-xs text-muted-foreground">+50 since last week</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹45,231.89</div>
          <p className="text-xs text-muted-foreground">+20.1% from last month</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Games</CardTitle>
          <Gamepad2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">4</div>
          <p className="text-xs text-muted-foreground">WinGo 1,3,5,10 Min</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">5</div>
          <p className="text-xs text-muted-foreground">₹8,500 total</p>
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
      
      const newBalance = operation === 'add' 
        ? (user.balance || 0) + amount 
        : (user.balance || 0) - amount;
  
      const userRef = doc(firestore, 'users', user.id);
      // Use the non-blocking update function
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
            <p>Current Balance: ₹{(user.balance || 0).toFixed(2)}</p>
            <Label htmlFor="amount">Amount</Label>
            <Input 
              id="amount" 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
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
                <TableCell>₹{(user.balance || 0).toFixed(2)}</TableCell>
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
    const { data: requests, isLoading } = useCollection<(Omit<T, 'id'> & { id: string; path: string })>(requestsQuery);

    const [requestsWithUsers, setRequestsWithUsers] = useState<(T & { user?: User; path: string })[]>([]);
    
    useEffect(() => {
        const fetchUsers = async () => {
            if (requests && firestore) {
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
            }
        };
        fetchUsers();
    }, [requests, firestore]);

    return { data: requestsWithUsers, isLoading };
};

export function DepositsTab() {
    const { data: deposits, isLoading } = useRequests<Deposit>('deposits');
    const { firestore } = useFirebase();
  
    const handleRequest = async (deposit: Deposit & {path: string}, newStatus: 'approved' | 'rejected') => {
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
                    const newBalance = (userDoc.data().balance || 0) + deposit.amount;
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
              <TableRow key={deposit.id}>
                <TableCell>{deposit.user?.name || deposit.userId}</TableCell>
                <TableCell>₹{deposit.amount.toFixed(2)}</TableCell>
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

    const handleRequest = async (withdrawal: Withdrawal & {path: string}, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;
        
        const withdrawalRef = doc(firestore, withdrawal.path);

        try {
            await runTransaction(firestore, async (transaction) => {
                const userRef = doc(firestore, "users", withdrawal.userId);
                
                // Only touch balance if the new status is 'approved'
                if (newStatus === 'approved' && withdrawal.status === 'pending') {
                    const userDoc = await transaction.get(userRef);

                    if (!userDoc.exists() || userDoc.data().balance < withdrawal.amount) {
                        throw "Insufficient balance or user not found!";
                    }
                    
                    const newBalance = userDoc.data().balance - withdrawal.amount;
                    transaction.update(userRef, { balance: newBalance });
                }
                
                // For rejections, just update the status, no balance change.
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
                <TableRow key={w.id}>
                  <TableCell>{w.user?.name || w.userId}</TableCell>
                  <TableCell>₹{w.amount.toFixed(2)}</TableCell>
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
    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader><CardTitle>Manual Result</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Input placeholder="Enter number 0-9" type="number" min="0" max="9" />
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
                            {DUMMY_RESULTS.map((r) => (
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
