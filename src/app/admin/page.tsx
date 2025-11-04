'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCollection } from '@/firebase/firestore/use-collection'
import { collection, doc, getDocs, query, updateDoc, writeBatch } from 'firebase/firestore'
import { useFirebase, useMemoFirebase } from '@/firebase'
import type { User, Deposit, Withdrawal } from '@/lib/types'
import { signOut } from 'firebase/auth'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LogOut, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'


function BalanceDialog({ user, onUpdate }: { user: User, onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const handleBalanceUpdate = async (operation: 'add' | 'deduct') => {
    if (!firestore || !user || isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid amount > 0" });
      return;
    }

    const userRef = doc(firestore, 'users', user.id);
    const currentBalance = Number(user.balance) || 0;
    const newBalance = operation === 'add' ? currentBalance + amount : currentBalance - amount;

    if (newBalance < 0) {
      toast({ variant: "destructive", title: "Invalid Operation", description: "Balance cannot be negative." });
      return;
    }

    try {
      await updateDoc(userRef, { balance: newBalance });
      toast({ title: "Success", description: `Balance for ${user.name} updated to ₹${newBalance.toFixed(2)}` });
      setOpen(false);
      setAmount(0);
      onUpdate(); // Trigger refresh
    } catch (error) {
      console.error("Failed to update balance:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update balance." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Edit Balance</Button></DialogTrigger>
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


export default function AdminPage() {
  const { firestore, auth, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [key, setKey] = useState(0); // State to force re-render/re-fetch
  const { toast } = useToast();

  useEffect(() => {
    // Redirect to login if user is not authenticated or not the admin
    if (!isUserLoading && (!user || user.email !== 'admin@tiranga.in')) {
      router.replace('/admin/login');
    }
  }, [user, isUserLoading, router]);

  const forceRefresh = () => setKey(prevKey => prevKey + 1);
  
  const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore, key]);
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersRef);

  const [deposits, setDeposits] = useState<(Deposit & { user?: User })[]>([]);
  const [withdrawals, setWithdrawals] = useState<(Withdrawal & { user?: User })[]>([]);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(true);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(true);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchRequests = async () => {
      // Fetch all users first to map them to requests
      const userList = users || [];

      // Fetch Deposits
      setIsLoadingDeposits(true);
      const depositQuery = query(collection(firestore, 'deposits'), where('status', '==', 'pending'));
      const depositSnap = await getDocs(depositQuery);
      const depositData = depositSnap.docs.map(d => ({ ...d.data(), id: d.id } as Deposit))
        .map(dep => ({ ...dep, user: userList.find(u => u.id === dep.userId) }));
      setDeposits(depositData);
      setIsLoadingDeposits(false);

      // Fetch Withdrawals
      setIsLoadingWithdrawals(true);
      const withdrawalQuery = query(collection(firestore, 'withdrawals'), where('status', '==', 'pending'));
      const withdrawalSnap = await getDocs(withdrawalQuery);
      const withdrawalData = withdrawalSnap.docs.map(d => ({ ...d.data(), id: d.id } as Withdrawal))
       .map(wd => ({ ...wd, user: userList.find(u => u.id === wd.userId) }));
      setWithdrawals(withdrawalData);
      setIsLoadingWithdrawals(false);
    };

    // We fetch requests only when the `users` data is available to map user info
    if(users) {
      fetchRequests();
    }
  }, [firestore, user, users, key]);

  const handleRequest = async (type: 'deposit' | 'withdrawal', requestId: string, userId: string, amount: number, action: 'approved' | 'rejected') => {
    if (!firestore) return;

    const requestRef = doc(firestore, `${type}s`, requestId);
    const userRef = doc(firestore, 'users', userId);
    const currentUserData = users?.find(u => u.id === userId);

    if (!currentUserData) {
        toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
        return;
    }

    try {
      const batch = writeBatch(firestore);
      const currentBalance = currentUserData.balance || 0;

      if (action === 'approved') {
        if (type === 'deposit') {
          batch.update(userRef, { balance: currentBalance + amount });
        } else { // withdrawal
           if(currentBalance < amount) {
                toast({ variant: 'destructive', title: 'Insufficient Balance', description: `User only has ₹${currentBalance.toFixed(2)}.` });
                return;
           }
           batch.update(userRef, { balance: currentBalance - amount });
        }
      }
      
      batch.update(requestRef, { status: action });
      await batch.commit();

      toast({ title: 'Success', description: `Request has been ${action}.` });
      forceRefresh();
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      toast({ variant: 'destructive', title: 'Error', description: `Could not process the request.` });
    }
  };


  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push("/admin/login");
    }
  };

  const filteredUsers = users?.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.phone && u.phone.includes(searchTerm)) ||
    (u.emailId && u.emailId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isUserLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading Admin Panel...</p>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-primary">Tiranga Admin</h1>
        <Button onClick={handleLogout} variant="outline">
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </header>
      
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="deposits">Deposit Requests</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawal Requests</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
            <Card>
                <CardHeader className='flex-row items-center justify-between'>
                <CardTitle>All Users</CardTitle>
                <div className='flex items-center gap-2'>
                    <p className='text-sm text-muted-foreground'>Total Users: {filteredUsers?.length || 0}</p>
                    <Button size="icon" variant="ghost" onClick={forceRefresh}>
                        <RefreshCw className='h-4 w-4' />
                    </Button>
                </div>
                </CardHeader>
                <CardContent>
                <Input 
                    placeholder="Search by name, phone, or email ID..." 
                    className="max-w-sm mb-4"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {isLoadingUsers ? (<p>Loading users...</p>) : (
                    <>
                    {usersError && <p className="text-destructive">Error: Could not load users. Check security rules and console.</p>}
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email ID</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Join Date</TableHead>
                        <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers?.map((u) => (
                        <TableRow key={u.id}>
                            <TableCell>
                            <div className="font-medium">{u.name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{u.phone}</div>
                            </TableCell>
                            <TableCell>{u.emailId}</TableCell>
                            <TableCell>₹{(Number(u.balance) || 0).toFixed(2)}</TableCell>
                            <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                            <TableCell className="text-right">
                                <BalanceDialog user={u} onUpdate={forceRefresh} />
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                    </>
                )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="deposits">
           <Card>
                <CardHeader>
                    <CardTitle>Pending Deposit Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingDeposits ? <p>Loading requests...</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {deposits.map(d => (
                                    <TableRow key={d.id}>
                                        <TableCell>{d.user?.name || 'Unknown User'}<br/><span className="text-xs text-muted-foreground">{d.userId}</span></TableCell>
                                        <TableCell>₹{d.amount.toFixed(2)}</TableCell>
                                        <TableCell>{d.requestedAt ? new Date(d.requestedAt).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button size="sm" variant="outline" onClick={() => handleRequest('deposit', d.id, d.userId, d.amount, 'approved')}>Approve</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleRequest('deposit', d.id, d.userId, d.amount, 'rejected')}>Reject</Button>
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
            <Card>
                <CardHeader>
                    <CardTitle>Pending Withdrawal Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingWithdrawals ? <p>Loading requests...</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>UPI/Bank</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {withdrawals.map(w => (
                                    <TableRow key={w.id}>
                                        <TableCell>{w.user?.name || 'Unknown User'}<br/><span className="text-xs text-muted-foreground">{w.userId}</span></TableCell>
                                        <TableCell>₹{w.amount.toFixed(2)}</TableCell>
                                        <TableCell>{w.upiBank}</TableCell>
                                        <TableCell>{w.requestedAt ? new Date(w.requestedAt).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button size="sm" variant="outline" onClick={() => handleRequest('withdrawal', w.id, w.userId, w.amount, 'approved')}>Approve</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleRequest('withdrawal', w.id, w.userId, w.amount, 'rejected')}>Reject</Button>
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
    </div>
  );
}
