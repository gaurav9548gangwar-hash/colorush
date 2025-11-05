
'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection,
  doc,
  query,
  updateDoc,
  writeBatch,
  getDoc,
  where,
  increment,
  type Timestamp,
} from 'firebase/firestore'
import { useFirebase, useMemoFirebase } from '@/firebase'
import type { User, DepositRequest, WithdrawalRequest } from '@/lib/types'
import { useCollection } from '@/firebase/firestore/use-collection'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LogOut, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'


// #####################################################################
//                       BALANCE EDIT DIALOG
// #####################################################################
function BalanceDialog({ user, onUpdate }: { user: User, onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const handleBalanceUpdate = async (operation: 'add' | 'deduct') => {
    if (!firestore || !user || isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid positive amount." });
      return;
    }

    setIsSubmitting(true);
    const userRef = doc(firestore, 'users', user.id);
    const newBalance = operation === 'add' ? increment(amount) : increment(-amount);
    
    if (operation === 'deduct' && (user.balance < amount)) {
        toast({ variant: "destructive", title: "Invalid Operation", description: "Deduction amount cannot be greater than the user's balance." });
        setIsSubmitting(false);
        return;
    }
    
    const requestData = { balance: newBalance };

    updateDoc(userRef, requestData).then(() => {
        toast({ title: "Success", description: `${user.name}'s balance has been updated.` });
        onUpdate(); 
        setOpen(false);
        setAmount(0);
    }).catch(error => {
        const contextualError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: { balance: `increment(${operation === 'add' ? amount : -amount})` },
        });
        errorEmitter.emit('permission-error', contextualError);
        toast({ variant: "destructive", title: "Error", description: "Failed to update balance. Check permissions." });
    }).finally(() => {
        setIsSubmitting(false);
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
          <p>Current Balance: <strong>₹{(Number(user.balance) || 0).toFixed(2)}</strong></p>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            value={amount <= 0 ? '' : amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Enter amount to add or deduct"
          />
        </div>
        <DialogFooter className="flex-row justify-end space-x-2">
          <Button onClick={() => handleBalanceUpdate('add')} disabled={isSubmitting}>Add Balance</Button>
          <Button variant="destructive" onClick={() => handleBalanceUpdate('deduct')} disabled={isSubmitting}>Deduct Balance</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// #####################################################################
//                       USERS MANAGEMENT TAB
// #####################################################################
function UsersTab({ onUpdate, keyForRefresh }: { onUpdate: () => void, keyForRefresh: number }) {
    const { firestore } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');

    const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore, keyForRefresh]);
    const { data: users, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersRef);

    const filteredUsers = useMemo(() => users?.filter(u => 
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.phone && u.phone.includes(searchTerm)) ||
        (u.emailId && u.emailId.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [users, searchTerm]);
    
    return (
        <Card>
            <CardHeader className='flex-row items-center justify-between'>
                <CardTitle>All Users</CardTitle>
                <div className='flex items-center gap-2'>
                    <p className='text-sm text-muted-foreground'>Total Users: {filteredUsers?.length || 0}</p>
                    <Button size="icon" variant="ghost" onClick={onUpdate} aria-label="Refresh Users">
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
                {isLoadingUsers && <p className="text-center py-4">Loading users...</p>}
                {usersError && <p className="text-destructive text-center py-4">Error loading users. Check security rules and console.</p>}
                {!isLoadingUsers && !usersError && (
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
                            {filteredUsers && filteredUsers.length > 0 ? filteredUsers.map((u) => (
                                <TableRow key={u.id}>
                                    <TableCell>
                                        <div className="font-medium">{u.name || 'N/A'}</div>
                                        <div className="text-sm text-muted-foreground">{u.phone}</div>
                                    </TableCell>
                                    <TableCell>{u.emailId}</TableCell>
                                    <TableCell>₹{(Number(u.balance) || 0).toFixed(2)}</TableCell>
                                    <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <BalanceDialog user={u} onUpdate={onUpdate} />
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="text-center">No users found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

// #####################################################################
//                       DEPOSIT REQUESTS TAB
// #####################################################################
function DepositRequestsTab({ keyForRefresh, onUpdate }: { keyForRefresh: number, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    // The query now EXACTLY matches the security rule
    const depositsRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'deposits'), where('status', '==', 'pending'));
    }, [firestore, keyForRefresh]);

    const { data: deposits, isLoading, error } = useCollection<DepositRequest>(depositsRef);

    const handleRequest = async (request: DepositRequest, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;

        const batch = writeBatch(firestore);
        const requestRef = doc(firestore, 'deposits', request.id);
        batch.update(requestRef, { status: newStatus });

        if (newStatus === 'approved') {
            const userRef = doc(firestore, 'users', request.userId);
            batch.update(userRef, { balance: increment(request.amount) });
        }
        
        try {
            await batch.commit();
            toast({ title: 'Success', description: `Request has been ${newStatus}.` });
            onUpdate();
        } catch (err) {
            const contextualError = new FirestorePermissionError({
                path: requestRef.path,
                operation: 'update',
                requestResourceData: { status: newStatus },
            });
            errorEmitter.emit('permission-error', contextualError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update request. Check permissions.' });
        }
    }

    const formatDate = (timestamp: Timestamp | Date | string | undefined) => {
        if (!timestamp) return 'N/A';
        if (typeof (timestamp as Timestamp).toDate === 'function') {
            return (timestamp as Timestamp).toDate().toLocaleString();
        }
        return new Date(timestamp as any).toLocaleString();
    }

    return (
        <Card>
            <CardHeader><CardTitle>Pending Deposit Requests</CardTitle></CardHeader>
            <CardContent>
                {isLoading && <p className="text-center py-4">Loading requests...</p>}
                {error && <p className="text-destructive text-center py-4">Error: {error.message}</p>}
                {!isLoading && !error && (
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
                            {deposits && deposits.length > 0 ? deposits.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell>{req.userName}</TableCell>
                                    <TableCell>₹{req.amount.toFixed(2)}</TableCell>
                                    <TableCell>{req.transactionId}</TableCell>
                                    <TableCell>{formatDate(req.createdAt)}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" variant="ghost" className="text-green-500" onClick={() => handleRequest(req, 'approved')}><CheckCircle className="mr-2"/>Approve</Button>
                                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleRequest(req, 'rejected')}><XCircle className="mr-2"/>Reject</Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="text-center">No pending deposit requests.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

// #####################################################################
//                     WITHDRAWAL REQUESTS TAB
// #####################################################################
function WithdrawalRequestsTab({ keyForRefresh, onUpdate }: { keyForRefresh: number, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    // The query now EXACTLY matches the security rule
    const withdrawalsRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'withdrawals'), where('status', '==', 'pending'));
    },[firestore, keyForRefresh]);
    
    const { data: withdrawals, isLoading, error } = useCollection<WithdrawalRequest>(withdrawalsRef);
    
    const handleRequest = async (request: WithdrawalRequest, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;

        const userRef = doc(firestore, 'users', request.userId);
        const requestRef = doc(firestore, 'withdrawals', request.id);
        const batch = writeBatch(firestore);

        try {
            if (newStatus === 'approved') {
                const userDoc = await getDoc(userRef);
                const currentBalance = userDoc.exists() ? userDoc.data().balance : 0;
                
                if (currentBalance < request.amount) {
                    toast({ variant: 'destructive', title: 'Insufficient Balance', description: 'User does not have enough funds for this withdrawal.' });
                    batch.update(requestRef, { status: 'rejected', reason: 'Insufficient balance' });
                } else {
                    batch.update(userRef, { balance: increment(-request.amount) });
                    batch.update(requestRef, { status: 'approved' });
                }
            } else { 
                batch.update(requestRef, { status: 'rejected' });
            }

            await batch.commit();
            toast({ title: 'Success', description: `Request has been processed.` });
            onUpdate();
        } catch (err) {
             const contextualError = new FirestorePermissionError({
                path: requestRef.path,
                operation: 'update',
                requestResourceData: { status: newStatus },
             });
             errorEmitter.emit('permission-error', contextualError);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not update request. Check permissions.' });
        }
    }

    const formatDate = (timestamp: Timestamp | Date | string | undefined) => {
        if (!timestamp) return 'N/A';
        if (typeof (timestamp as Timestamp).toDate === 'function') {
            return (timestamp as Timestamp).toDate().toLocaleString();
        }
        return new Date(timestamp as any).toLocaleString();
    }

    return (
        <Card>
            <CardHeader><CardTitle>Pending Withdrawal Requests</CardTitle></CardHeader>
            <CardContent>
                {isLoading && <p className="text-center py-4">Loading requests...</p>}
                {error && <p className="text-destructive text-center py-4">Error: {error.message}</p>}
                {!isLoading && !error && (
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
                          {withdrawals && withdrawals.length > 0 ? withdrawals.map(req => (
                              <TableRow key={req.id}>
                                  <TableCell>{req.userName}</TableCell>
                                  <TableCell>₹{req.amount.toFixed(2)}</TableCell>
                                  <TableCell>{req.upiId}</TableCell>
                                  <TableCell>{formatDate(req.createdAt)}</TableCell>
                                  <TableCell className="text-right space-x-2">
                                      <Button size="sm" variant="ghost" className="text-green-500" onClick={() => handleRequest(req, 'approved')}><CheckCircle className="mr-2"/>Approve</Button>
                                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleRequest(req, 'rejected')}><XCircle className="mr-2"/>Reject</Button>
                                  </TableCell>
                              </TableRow>
                          )) : (
                              <TableRow><TableCell colSpan={5} className="text-center">No pending withdrawal requests.</TableCell></TableRow>
                          )}
                      </TableBody>
                  </Table>
                )}
            </CardContent>
        </Card>
    )
}

// #####################################################################
//                         MAIN ADMIN PAGE
// #####################################################################
export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
      router.replace('/admin/login');
    } else {
      setIsAuthenticating(false);
    }
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    router.push("/admin/login");
  };

  const forceRefresh = useCallback(() => setRefreshKey(prevKey => prevKey + 1), []);

  if (isAuthenticating) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Verifying Admin session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex items-center justify-between pb-6">
        <h1 className="text-3xl font-bold text-primary">Admin Panel</h1>
        <Button onClick={handleLogout} variant="outline">
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </header>
      
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="deposits">Deposit Requests</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawal Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
            <UsersTab onUpdate={forceRefresh} keyForRefresh={refreshKey} />
        </TabsContent>
        <TabsContent value="deposits" className="mt-4">
            <DepositRequestsTab onUpdate={forceRefresh} keyForRefresh={refreshKey} />
        </TabsContent>
        <TabsContent value="withdrawals" className="mt-4">
            <WithdrawalRequestsTab onUpdate={forceRefresh} keyForRefresh={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
