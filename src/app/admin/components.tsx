'use client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DepositRequest, GameResult, User, WithdrawalRequest } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Gamepad2, Users, DollarSign } from "lucide-react";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { doc, updateDoc } from "firebase/firestore";

const DUMMY_DEPOSITS: DepositRequest[] = [
  { id: 'd1', userId: '1', userName: 'John Doe', amount: 500, status: 'pending', date: '2024-03-18' },
];
const DUMMY_WITHDRAWALS: WithdrawalRequest[] = [
  { id: 'w1', userId: '2', userName: 'Jane Smith', amount: 100, upi: 'jane@upi', status: 'pending', date: '2024-03-18' },
];
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
  
    const handleBalanceUpdate = async (operation: 'add' | 'deduct') => {
      if (!firestore) return;
      const newBalance = operation === 'add' 
        ? user.balance + amount 
        : user.balance - amount;
  
      const userRef = doc(firestore, 'users', user.id);
      await updateDoc(userRef, { balance: newBalance });
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
            <p>Current Balance: ₹{user.balance.toFixed(2)}</p>
            <Label htmlFor="amount">Amount</Label>
            <Input 
              id="amount" 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <DialogFooter className="space-x-2">
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
                <TableCell>₹{user.balance.toFixed(2)}</TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
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

export function DepositsTab() {
  return (
    <Card>
      <CardHeader><CardTitle>Pending Deposit Requests</CardTitle></CardHeader>
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
            {DUMMY_DEPOSITS.map((deposit) => (
              <TableRow key={deposit.id}>
                <TableCell>{deposit.userName}</TableCell>
                <TableCell>₹{deposit.amount.toFixed(2)}</TableCell>
                <TableCell>{deposit.date}</TableCell>
                <TableCell><Badge variant="secondary">{deposit.status}</Badge></TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="default">Approve</Button>
                  <Button size="sm" variant="destructive">Reject</Button>
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
    return (
      <Card>
        <CardHeader><CardTitle>Pending Withdrawal Requests</CardTitle></CardHeader>
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
              {DUMMY_WITHDRAWALS.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.userName}</TableCell>
                  <TableCell>₹{w.amount.toFixed(2)}</TableCell>
                  <TableCell>{w.upi}</TableCell>
                  <TableCell>{w.date}</TableCell>
                  <TableCell><Badge variant="secondary">{w.status}</Badge></TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm">Approve</Button>
                    <Button size="sm" variant="destructive">Reject</Button>
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
