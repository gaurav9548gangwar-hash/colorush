'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFirebase } from '@/firebase'
import { addDoc, collection, doc, serverTimestamp } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDoc } from '@/firebase/firestore/use-doc'
import type { User } from '@/lib/types'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

const MIN_WITHDRAWAL = 500

export default function WithdrawPage() {
  const { firestore, user, isUserLoading } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()
  
  const [amount, setAmount] = useState(MIN_WITHDRAWAL)
  const [upiId, setUpiId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const userDocRef = useMemo(() => {
    if (firestore && user) {
      return doc(firestore, 'users', user.uid)
    }
    return null
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDocLoading } = useDoc<User>(userDocRef)

  useEffect(() => {
      if (!isUserLoading && !user) {
        router.replace('/login')
      }
  }, [isUserLoading, user, router]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firestore || !user || !userData) return

    if (amount < MIN_WITHDRAWAL) {
        toast({
            variant: 'destructive',
            title: 'Invalid Amount',
            description: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}.`
        })
        return
    }

    if (amount > userData.balance) {
         toast({
            variant: 'destructive',
            title: 'Insufficient Balance',
            description: `You cannot withdraw more than your available balance of ₹${userData.balance.toFixed(2)}.`
        })
        return
    }

     if (!upiId.trim()) {
        toast({
            variant: 'destructive',
            title: 'UPI ID Required',
            description: 'Please enter your UPI ID to receive the payment.'
        })
        return
    }

    setIsSubmitting(true);
    const withdrawalData = {
        userId: user.uid,
        userName: userData.name || 'N/A',
        amount: Number(amount),
        upiId,
        status: 'pending',
        createdAt: serverTimestamp(),
    };

    addDoc(collection(firestore, 'withdrawals'), withdrawalData)
        .then(() => {
            toast({
                title: 'Request Submitted',
                description: 'Your withdrawal request has been sent. It will be processed by our team shortly.'
            });
            router.push('/dashboard');
        })
        .catch((error) => {
            const contextualError = new FirestorePermissionError({
                path: 'withdrawals',
                operation: 'create',
                requestResourceData: withdrawalData,
            });
            errorEmitter.emit('permission-error', contextualError);
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: "Check console for details."
            });
        })
        .finally(() => {
            setIsSubmitting(false);
        });
  }

   if (isUserLoading || isUserDocLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
           <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.back()}>
                <ArrowLeft />
            </Button>
          <CardTitle className="text-center pt-8">Withdraw Funds</CardTitle>
          <CardDescription className="text-center">Request a withdrawal to your UPI ID.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <Alert variant={userData && userData.balance < MIN_WITHDRAWAL ? 'destructive' : 'default'}>
                <AlertTitle className="font-bold">Withdrawal Rules</AlertTitle>
                <AlertDescription>
                    <p>Minimum withdrawal amount is <strong>₹{MIN_WITHDRAWAL}</strong>.</p>
                    <p>Your current balance is <strong>₹{(userData?.balance || 0).toFixed(2)}</strong>.</p>
                </AlertDescription>
            </Alert>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="amount">Amount to Withdraw</Label>
                    <Input 
                        id="amount" 
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder={`e.g. ${MIN_WITHDRAWAL}`}
                        min={MIN_WITHDRAWAL}
                        required
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="upiId">Your UPI ID</Label>
                    <Input 
                        id="upiId" 
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@bank"
                        required
                    />
                </div>
                 <Button type="submit" className="w-full" disabled={isSubmitting || (userData?.balance || 0) < MIN_WITHDRAWAL}>
                    {isSubmitting ? 'Submitting Request...' : 'Submit Request'}
                </Button>
            </form>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">Your request will be processed within 24 hours. The amount will be deducted from your wallet after approval.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
