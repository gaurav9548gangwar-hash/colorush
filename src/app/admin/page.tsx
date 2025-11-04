'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, doc, query, updateDoc, writeBatch, where, onSnapshot, Unsubscribe, getDoc } from 'firebase/firestore'
import { useFirebase, useMemoFirebase } from '@/firebase'
import type { User, Deposit, Withdrawal } from '@/lib/types'
import { FirestorePermissionError } from '@/firebase/errors'
import { errorEmitter } from '@/firebase/error-emitter'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LogOut, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCollection } from '@/firebase/firestore/use-collection'


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
      toast({ variant: "destructive", title: "Error", description: "Failed to update balance. Check Firestore rules." });
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
  const { firestore } = useFirebase();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [key, setKey] = useState(0); // State to force re-render/re-fetch for users
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    // Check if the user is logged in via session storage
    if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
      router.replace('/admin/login');
    } else {
      setIsAuthenticating(false);
    }
  }, [router]);

  const forceUserRefresh = () => setKey(prevKey => prevKey + 1);
  
  const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore, key]);
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersRef);

  const [deposits, setDeposits] = useState<(Deposit & { user?: User })[]>([]);
  const [withdrawals, setWithdrawals] = useState<(Withdrawal & { user?: User })[]>([]);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(true);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(true);
  
  
  useEffect(() => {
    if (!firestore || isAuthenticating) return;
  
    const fetchUserDataForRequests = async (requests: (Deposit | Withdrawal)[]) => {
      const userCache = new Map<string, User>();

      const requestsWithUsers = await Promise.all(
        requests.map(async (req) => {
          if (userCache.has(req.userId)) {
            return { ...req, user: userCache.get(req.userId) };
          }
          try {
            const userDoc = await getDoc(doc(firestore, 'users', req.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as User;
              userCache.set(req.userId, userData);
              return { ...req, user: userData };
            }
          } catch (e) {
            console.error(`Failed to fetch user ${req.userId}`, e);
          }
          return { ...req, user: undefined }; // Return request even if user fetch fails
        })
      );
      return requestsWithUsers;
    };
  
    let depositUnsubscribe: Unsubscribe | undefined;
    let withdrawalUnsubscribe: Unsubscribe | undefined;
    
    // Real-time listener for Deposits
    setIsLoadingDeposits(true);
    const depositQuery = query(collection(firestore, 'deposits'), where('status', 'in', ['pending', 'pending_upload']));
    depositUnsubscribe = onSnapshot(depositQuery, async (snapshot) => {
        const depositData = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Deposit));
        const depositsWithUsers = await fetchUserDataForRequests(depositData);
        setDeposits(depositsWithUsers);
        setIsLoadingDeposits(false);
    }, (error) => {
        setIsLoadingDeposits(false);
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: 'deposits'
        });
        errorEmitter.emit('permission-error', contextualError);
    });
  
    // Real-time listener for Withdrawals
    setIsLoadingWithdrawals(true);
    const withdrawalQuery = query(collection(firestore, 'withdrawals'), where('status', '==', 'pending'));
    withdrawalUnsubscribe = onSnapshot(withdrawalQuery, async (snapshot) => {
        const withdrawalData = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Withdrawal));
        const withdrawalsWithUsers = await fetchUserDataForRequests(withdrawalData);
        setWithdrawals(withdrawalsWithUsers);
        setIsLoadingWithdrawals(false);
    }, (error) => {
        setIsLoadingWithdrawals(false);
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: 'withdrawals'
        });
        errorEmitter.emit('permission-error', contextualError);
    });
    
    // Cleanup listeners on component unmount
    return () => {
        if (depositUnsubscribe) depositUnsubscribe();
        if (withdrawalUnsubscribe) withdrawalUnsubscribe();
    };
  }, [firestore, isAuthenticating]);


  const handleRequest = async (type: 'deposit' | 'withdrawal', requestId: string, userId: string, amount: number, action: 'approved' | 'rejected') => {
    if (!firestore) return;

    const requestRef = doc(firestore, `${type}s`, requestId);
    const userRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userRef);


    if (!userDoc.exists()) {
        toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
        return;
    }
    const currentUserData = userDoc.data() as User;


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
      // No need for manual refresh with onSnapshot
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      toast({ variant: 'destructive', title: 'Error', description: `Could not process the request.` });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    router.push("/admin/login");
  };

  const filteredUsers = users?.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.phone && u.phone.includes(searchTerm)) ||
    (u.emailId && u.emailId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isAuthenticating) {
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
                    <Button size="icon" variant="ghost" onClick={forceUserRefresh}>
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
                    {usersError && <p className="text-destructive">Error: {usersError.message}. Check security rules and console.</p>}
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email ID</TableHead>
                        <TableHead>Password</TableHead>
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
                            <TableCell>{u.password || 'N/A'}</TableCell>
                            <TableCell>₹{(Number(u.balance) || 0).toFixed(2)}</TableCell>
                            <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                            <TableCell className="text-right">
                                <BalanceDialog user={u} onUpdate={forceUserRefresh} />
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
                                    <TableHead>Screenshot</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {deposits.map(d => (
                                    <TableRow key={d.id}>
                                        <TableCell>{d.user?.name || 'Unknown User'}<br/><span className="text-xs text-muted-foreground">{d.userId}</span></TableCell>
                                        <TableCell>₹{d.amount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            {d.screenshotUrl ? (
                                                <a href={d.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a>
                                            ) : d.status === 'pending_upload' ? (
                                                <span className="text-muted-foreground text-xs">Uploading...</span>
                                            ) : (
                                                <span className="text-destructive text-xs">Missing</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{d.requestedAt ? new Date(d.requestedAt).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button size="sm" variant="outline" onClick={() => handleRequest('deposit', d.id, d.userId, d.amount, 'approved')} disabled={!d.screenshotUrl}>Approve</Button>
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

    