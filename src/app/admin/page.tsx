'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection,
  doc,
  query,
  updateDoc,
  setDoc,
  getDoc,
  where,
  increment,
  type Timestamp,
  deleteDoc,
  type Firestore,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { useFirebase, useMemoFirebase } from '@/firebase'
import type { User, DepositRequest, WithdrawalRequest, Notification } from '@/lib/types'
import { useCollection } from '@/firebase/firestore/use-collection'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LogOut, RefreshCw, CheckCircle, XCircle, Trash2, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'


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
    const currentBalance = Number(user.balance) || 0;
    
    if (operation === 'deduct' && (currentBalance < amount)) {
        toast({ variant: "destructive", title: "Invalid Operation", description: "Deduction amount cannot be greater than the user's balance." });
        setIsSubmitting(false);
        return;
    }

    const newBalanceIncrement = operation === 'add' ? increment(amount) : increment(-amount);
    
    const updateData = { balance: newBalanceIncrement };

    updateDoc(userRef, updateData).catch(error => {
        const contextualError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', contextualError);
    }).then(() => {
        toast({ title: "Success", description: `${user.name}'s balance has been updated.` });
        onUpdate(); 
        setOpen(false);
        setAmount(0);
    }).finally(() => {
        setIsSubmitting(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Edit Balance</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Balance for {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>Current Balance: <strong>INR {(Number(user.balance) || 0).toFixed(2)}</strong></p>
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
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');

    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: users, isLoading: isLoadingUsers, error: usersError, manualRefresh } = useCollection<User>(usersQuery);
    
    useEffect(() => {
        if(usersQuery) manualRefresh();
    }, [keyForRefresh, manualRefresh, usersQuery]);


    const filteredUsers = useMemo(() => users?.filter(u => 
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.phone && u.phone.includes(searchTerm))
    ), [users, searchTerm]);

    const handleDeleteUser = async (userId: string) => {
        if (!firestore) return;
        
        const userDocRef = doc(firestore, 'users', userId);

        deleteDoc(userDocRef).catch(error => {
            const contextualError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', contextualError);
        }).then(() => {
            toast({ title: "User Deleted", description: "The user's data has been removed from Firestore." });
            onUpdate(); // Refresh the user list
        });
    };
    
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
                    placeholder="Search by name or phone..." 
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
                                <TableHead>Password</TableHead>
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
                                    <TableCell className="font-mono text-xs">{u.password || 'N/A'}</TableCell>
                                    <TableCell>INR {(Number(u.balance) || 0).toFixed(2)}</TableCell>
                                    <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <BalanceDialog user={u} onUpdate={onUpdate} />
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete the user's data from the database. 
                                                        Their authentication record will remain, but they won't be able to use the app.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(u.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
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
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const depositsQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'deposits'), where('status', '==', 'pending'));
    }, [firestore]);

    const { data: deposits, isLoading, error, manualRefresh } = useCollection<DepositRequest>(depositsQuery);

    useEffect(() => {
        if(depositsQuery) manualRefresh();
    }, [keyForRefresh, manualRefresh, depositsQuery]);


    const handleRequest = async (request: DepositRequest, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;
        setIsProcessing(request.id);

        const requestRef = doc(firestore, 'deposits', request.id);
        const userRef = doc(firestore, 'users', request.userId);

        try {
            if (newStatus === 'approved') {
                 const userDoc = await getDoc(userRef);
                 if (!userDoc.exists()) {
                    throw new Error("User document not found.");
                 }
                 const userData = userDoc.data() as User;
                 const newBalance = (userData.balance || 0) + request.amount;

                 let userUpdateData: any = { 
                    balance: increment(request.amount),
                    depositCount: increment(1)
                 };
                 
                 // If user is in losing phase, a new deposit resets them to winning phase.
                 if (!userData.inWinningPhase) {
                    userUpdateData.inWinningPhase = true;
                    userUpdateData.initialDeposit = request.amount;
                    userUpdateData.targetBalance = newBalance * 2;
                    userUpdateData.betsSinceLastWin = 0;
                 } else if (userData.initialDeposit === 0) {
                    // This is the first deposit for a new user
                    userUpdateData.initialDeposit = request.amount;
                    userUpdateData.targetBalance = newBalance * 2;
                 }

                // Award referral bonus on first deposit
                if (userData.depositCount === 0 && userData.referredBy) {
                    const referrerRef = doc(firestore, 'users', userData.referredBy);
                    const referrerDoc = await getDoc(referrerRef);
                    if (referrerDoc.exists()) {
                         updateDoc(referrerRef, { balance: increment(20) }).catch(err => {
                            const contextualError = new FirestorePermissionError({ path: referrerRef.path, operation: 'update' } satisfies SecurityRuleContext);
                            errorEmitter.emit('permission-error', contextualError);
                         }).then(() => {
                            toast({ title: 'Referral Bonus!', description: `20 INR bonus awarded to ${referrerDoc.data().name}.` });
                         });
                    }
                }

                await updateDoc(userRef, userUpdateData).catch(err => {
                    const contextualError = new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: userUpdateData });
                    errorEmitter.emit('permission-error', contextualError);
                    throw err; // Re-throw to stop the chain
                });
                
                await updateDoc(requestRef, { status: newStatus }).catch(err => {
                    const contextualError = new FirestorePermissionError({ path: requestRef.path, operation: 'update', requestResourceData: { status: newStatus } });
                    errorEmitter.emit('permission-error', contextualError);
                    throw err; // Re-throw to stop the chain
                });

                toast({ title: 'Success', description: `Request has been ${newStatus} and balance updated.` });
            } else { // newStatus is 'rejected'
                await updateDoc(requestRef, { status: newStatus }).catch(err => {
                    const contextualError = new FirestorePermissionError({ path: requestRef.path, operation: 'update', requestResourceData: { status: newStatus } });
                    errorEmitter.emit('permission-error', contextualError);
                    throw err; // Re-throw to stop the chain
                });
                toast({ title: 'Success', description: `Request has been ${newStatus}.` });
            }
        } catch (err: any) {
            // Errors are already emitted in the .catch blocks
             toast({ variant: 'destructive', title: 'Processing Failed', description: 'Could not process request. Check permissions.' });
        } finally {
            onUpdate();
            setIsProcessing(null);
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
                                <TableHead>Phone</TableHead>
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
                                    <TableCell>{req.userPhone}</TableCell>
                                    <TableCell>INR {req.amount.toFixed(2)}</TableCell>
                                    <TableCell>{req.transactionId}</TableCell>
                                    <TableCell>{formatDate(req.createdAt)}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" variant="ghost" className="text-green-500" onClick={() => handleRequest(req, 'approved')} disabled={isProcessing === req.id}><CheckCircle className="mr-2"/>Approve</Button>
                                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleRequest(req, 'rejected')} disabled={isProcessing === req.id}><XCircle className="mr-2"/>Reject</Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={6} className="text-center">No pending deposit requests.</TableCell></TableRow>
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
    const [isProcessing, setIsProcessing] = useState<string | null>(null);


    const withdrawalsQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'withdrawals'), where('status', '==', 'pending'));
    },[firestore]);
    
    const { data: withdrawals, isLoading, error, manualRefresh } = useCollection<WithdrawalRequest>(withdrawalsQuery);
    
    useEffect(() => {
        if(withdrawalsQuery) manualRefresh();
    }, [keyForRefresh, manualRefresh, withdrawalsQuery]);


    const handleRequest = async (request: WithdrawalRequest, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;
        setIsProcessing(request.id);

        const requestRef = doc(firestore, 'withdrawals', request.id);
        const userRef = doc(firestore, 'users', request.userId);

        try {
            if (newStatus === 'approved') {
                // On approval, we only need to update the request status.
                // The amount was already deducted when the user made the request.
                await updateDoc(requestRef, { status: 'approved' });
                toast({ title: 'Success', description: `Request has been approved.` });

            } else { // 'rejected'
                // If rejected, we must refund the amount to the user's balance.
                await updateDoc(userRef, { balance: increment(request.amount) });
                await updateDoc(requestRef, { status: 'rejected' });
                toast({ title: 'Success', description: `Request has been rejected and amount refunded.` });
            }
        } catch (err: any) {
             const isUserUpdateError = err.message.toLowerCase().includes('users');
             const errorPath = isUserUpdateError ? userRef.path : requestRef.path;
             const contextualError = new FirestorePermissionError({
                path: errorPath,
                operation: 'update',
                requestResourceData: { status: newStatus },
             });
             errorEmitter.emit('permission-error', contextualError);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not update request. Check permissions.' });
        } finally {
            onUpdate();
             setIsProcessing(null);
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
                              <TableHead>Phone</TableHead>
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
                                  <TableCell>{req.userPhone}</TableCell>
                                  <TableCell>INR {req.amount.toFixed(2)}</TableCell>
                                  <TableCell>{req.upiId}</TableCell>
                                  <TableCell>{formatDate(req.createdAt)}</TableCell>
                                  <TableCell className="text-right space-x-2">
                                      <Button size="sm" variant="ghost" className="text-green-500" onClick={() => handleRequest(req, 'approved')}  disabled={isProcessing === req.id}><CheckCircle className="mr-2"/>Approve</Button>
                                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleRequest(req, 'rejected')}  disabled={isProcessing === req.id}><XCircle className="mr-2"/>Reject</Button>
                                  </TableCell>
                              </TableRow>
                          )) : (
                              <TableRow><TableCell colSpan={6} className="text-center">No pending withdrawal requests.</TableCell></TableRow>
                          )}
                      </TableBody>
                  </Table>
                )}
            </CardContent>
        </Card>
    )
}

// #####################################################################
//                     NOTIFICATIONS TAB
// #####################################################################
function NotificationsTab() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;
        if (!title.trim() || !message.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Title and message cannot be empty.' });
            return;
        }

        setIsSending(true);

        const notificationData = {
            title,
            message,
            createdAt: serverTimestamp(),
        };

        addDoc(collection(firestore, 'notifications'), notificationData).catch(error => {
            const contextualError = new FirestorePermissionError({
                path: 'notifications',
                operation: 'create',
                requestResourceData: notificationData,
            });
            errorEmitter.emit('permission-error', contextualError);
            toast({ variant: 'destructive', title: 'Failed to Send', description: 'Could not send notification. Check permissions.' });
        }).then((docRef) => {
            if (docRef) {
              toast({ title: 'Success!', description: 'Notification has been sent to all users.' });
              setTitle('');
              setMessage('');
            }
        }).finally(() => {
            setIsSending(false);
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Send Notification</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSendNotification} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="notification-title">Title</Label>
                        <Input
                            id="notification-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Special Bonus!"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notification-message">Message</Label>
                        <Textarea
                            id="notification-message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Write your announcement here..."
                            required
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSending}>
                        {isSending ? 'Sending...' : <><Send className="mr-2 h-4 w-4" /> Send to All Users</>}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}


// #####################################################################
//                         MAIN ADMIN PAGE
// #####################################################################
export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Check if running on the client side before accessing sessionStorage
    if (typeof window !== 'undefined') {
      const isAdminLoggedIn = sessionStorage.getItem('isAdminLoggedIn') === 'true';
      if (!isAdminLoggedIn) {
        router.replace('/admin/login');
      } else {
        setIsAuthenticating(false);
      }
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" onClick={forceRefresh}>User Management</TabsTrigger>
          <TabsTrigger value="deposits" onClick={forceRefresh}>Deposit Requests</TabsTrigger>
          <TabsTrigger value="withdrawals" onClick={forceRefresh}>Withdrawal Requests</TabsTrigger>
          <TabsTrigger value="notifications" onClick={forceRefresh}>Send Notifications</TabsTrigger>
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
        <TabsContent value="notifications" className="mt-4">
            <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

    
