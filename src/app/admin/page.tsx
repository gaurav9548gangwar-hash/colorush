'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, doc, query, updateDoc, writeBatch, getDoc, orderBy, where, getDocs } from 'firebase/firestore'
import { useFirebase, useMemoFirebase } from '@/firebase'
import type { User, DepositRequest, WithdrawalRequest } from '@/lib/types'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LogOut, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCollection } from '@/firebase/firestore/use-collection'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'


function BalanceDialog({ user, onUpdate }: { user: User, onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const handleBalanceUpdate = (operation: 'add' | 'deduct') => {
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

    const balanceData = { balance: newBalance };
    updateDoc(userRef, balanceData)
      .then(() => {
        toast({ title: "Success", description: `Balance for ${user.name} updated to INR ${newBalance.toFixed(2)}` });
        setOpen(false);
        setAmount(0);
        onUpdate(); // Trigger refresh
      })
      .catch((error) => {
        const contextualError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: balanceData,
        });
        errorEmitter.emit('permission-error', contextualError);
        toast({ variant: "destructive", title: "Error", description: "Failed to update balance. Check permissions." });
      });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Edit Balance</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Balance for {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>Current Balance: INR {(Number(user.balance) || 0).toFixed(2)}</p>
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

function DepositRequestsTab() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [key, setKey] = useState(0);

    const depositsRef = useMemoFirebase(() => firestore 
        ? query(collection(firestore, 'deposits'), where('status', '==', 'pending'), orderBy('createdAt', 'desc')) 
        : null, [firestore, key]);
    const { data: deposits, isLoading } = useCollection<DepositRequest>(depositsRef);

    const handleRequest = async (request: DepositRequest, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;

        const batch = writeBatch(firestore);
        const requestRef = doc(firestore, 'deposits', request.id);
        batch.update(requestRef, { status: newStatus });

        if (newStatus === 'approved') {
            const userRef = doc(firestore, 'users', request.userId);
             try {
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    const currentBalance = userDoc.data().balance || 0;
                    batch.update(userRef, { balance: currentBalance + request.amount });
                } else {
                     toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
                     return;
                }
            } catch (e) {
                 const contextualError = new FirestorePermissionError({
                    path: userRef.path,
                    operation: 'get',
                 });
                 errorEmitter.emit('permission-error', contextualError);
                 toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch user to update balance.' });
                 return;
            }
        }
        
        batch.commit()
            .then(() => {
                toast({ title: 'Success', description: `Request has been ${newStatus}.` });
                setKey(k => k + 1); // Refresh data
            })
            .catch((error) => {
                const contextualError = new FirestorePermissionError({
                    path: requestRef.path,
                    operation: 'update',
                    requestResourceData: { status: newStatus },
                });
                errorEmitter.emit('permission-error', contextualError);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not update request.' });
            });
    }

    return (
        <Card>
            <CardHeader><CardTitle>Pending Deposit Requests</CardTitle></CardHeader>
            <CardContent>
                {isLoading && <p>Loading requests...</p>}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Transaction ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {deposits?.map(req => (
                            <TableRow key={req.id}>
                                <TableCell>{req.userName}</TableCell>
                                <TableCell>₹{req.amount.toFixed(2)}</TableCell>
                                <TableCell>{req.transactionId}</TableCell>
                                <TableCell>{new Date(req.createdAt.toDate()).toLocaleString()}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button size="sm" variant="ghost" className="text-green-500" onClick={() => handleRequest(req, 'approved')}><CheckCircle className="mr-2"/>Approve</Button>
                                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleRequest(req, 'rejected')}><XCircle className="mr-2"/>Reject</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 {deposits?.length === 0 && !isLoading && <p className="text-center text-muted-foreground py-4">No pending deposit requests.</p>}
            </CardContent>
        </Card>
    )
}

function WithdrawalRequestsTab() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [key, setKey] = useState(0);

    const withdrawalsRef = useMemoFirebase(() => firestore 
        ? query(collection(firestore, 'withdrawals'), where('status', '==', 'pending'), orderBy('createdAt', 'desc')) 
        : null, [firestore, key]);
    const { data: withdrawals, isLoading } = useCollection<WithdrawalRequest>(withdrawalsRef);
    
    const handleRequest = async (request: WithdrawalRequest, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;

        const batch = writeBatch(firestore);
        const requestRef = doc(firestore, 'withdrawals', request.id);
        
        try {
            const userRef = doc(firestore, 'users', request.userId);
            const userDoc = await getDoc(userRef);
            const currentBalance = userDoc.exists() ? userDoc.data().balance : 0;

            if (newStatus === 'approved') {
                if (currentBalance < request.amount) {
                    toast({ variant: 'destructive', title: 'Error', description: 'User has insufficient balance.' });
                    batch.update(requestRef, { status: 'rejected', reason: 'Insufficient balance' });
                    await batch.commit();
                    setKey(k => k + 1);
                    return;
                }
                batch.update(userRef, { balance: currentBalance - request.amount });
            }

            batch.update(requestRef, { status: newStatus });
            
            batch.commit()
                .then(() => {
                    toast({ title: 'Success', description: `Request has been ${newStatus}.` });
                    setKey(k => k + 1); // Refresh data
                })
                .catch((error) => {
                     const contextualError = new FirestorePermissionError({
                        path: requestRef.path,
                        operation: 'update',
                        requestResourceData: { status: newStatus },
                     });
                     errorEmitter.emit('permission-error', contextualError);
                     toast({ variant: 'destructive', title: 'Error', description: 'Could not update request.' });
                });

        } catch (error) {
            const contextualError = new FirestorePermissionError({
                path: doc(firestore, 'users', request.userId).path,
                operation: 'get',
            });
            errorEmitter.emit('permission-error', contextualError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch user to process request.' });
        }
    }


    return (
        <Card>
            <CardHeader><CardTitle>Pending Withdrawal Requests</CardTitle></CardHeader>
            <CardContent>
                {isLoading && <p>Loading requests...</p>}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>UPI ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {withdrawals?.map(req => (
                            <TableRow key={req.id}>
                                <TableCell>{req.userName}</TableCell>
                                <TableCell>₹{req.amount.toFixed(2)}</TableCell>
                                <TableCell>{req.upiId}</TableCell>
                                <TableCell>{new Date(req.createdAt.toDate()).toLocaleString()}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button size="sm" variant="ghost" className="text-green-500" onClick={() => handleRequest(req, 'approved')}><CheckCircle className="mr-2"/>Approve</Button>
                                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleRequest(req, 'rejected')}><XCircle className="mr-2"/>Reject</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {withdrawals?.length === 0 && !isLoading && <p className="text-center text-muted-foreground py-4">No pending withdrawal requests.</p>}
            </CardContent>
        </Card>
    )
}


export default function AdminPage() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [key, setKey] = useState(0); // State to force re-render/re-fetch for users
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  const forceUserRefresh = () => setKey(prevKey => prevKey + 1);

  useEffect(() => {
    // Check if the user is logged in via session storage
    if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
      router.replace('/admin/login');
    } else {
      setIsAuthenticating(false);
    }
  }, [router]);
  
  const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore, key]);
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersRef);

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
        <TabsList className="mb-4 grid w-full grid-cols-3">
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
                            <TableCell>INR {(Number(u.balance) || 0).toFixed(2)}</TableCell>
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
            <DepositRequestsTab />
        </TabsContent>
        <TabsContent value="withdrawals">
            <WithdrawalRequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
