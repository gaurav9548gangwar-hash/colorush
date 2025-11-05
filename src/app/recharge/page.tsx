
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
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useDoc } from '@/firebase/firestore/use-doc'
import type { User } from '@/lib/types'

const UPI_ID = 'colourtrest99955@ptyes'
const MIN_DEPOSIT = 200

export default function RechargePage() {
  const { firestore, user, isUserLoading } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()
  
  const [amount, setAmount] = useState(MIN_DEPOSIT)
  const [transactionId, setTransactionId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const userDocRef = useMemo(() => {
    if (firestore && user) {
      return doc(firestore, 'users', user.uid)
    }
    return null
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDocLoading } = useDoc<User>(userDocRef);

  useEffect(() => {
      if (!isUserLoading && !user) {
        router.replace('/login')
      }
  }, [isUserLoading, user, router]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firestore || !user || !userData) return

    if (amount < MIN_DEPOSIT) {
        toast({
            variant: 'destructive',
            title: 'Invalid Amount',
            description: `Minimum deposit amount is ₹${MIN_DEPOSIT}.`
        })
        return
    }
     if (!transactionId.trim()) {
        toast({
            variant: 'destructive',
            title: 'Transaction ID Required',
            description: 'Please enter the UPI transaction ID.'
        })
        return
    }

    setIsSubmitting(true);

    const depositData = {
        userId: user.uid,
        userName: userData.name || 'N/A',
        userPhone: userData.phone || 'N/A',
        amount: Number(amount),
        transactionId,
        status: 'pending',
        createdAt: serverTimestamp(),
    };

    addDoc(collection(firestore, 'deposits'), depositData)
      .then(() => {
        toast({
            title: 'Request Submitted',
            description: 'Your deposit request has been sent for verification. It will be processed shortly.'
        });
        router.push('/dashboard');
      })
      .catch((error) => {
        const contextualError = new FirestorePermissionError({
          path: 'deposits',
          operation: 'create',
          requestResourceData: depositData,
        });
        errorEmitter.emit('permission-error', contextualError);
        toast({
            variant: 'destructive',
            title: 'Submission Failed',
            description: "Check console for details."
        })
      })
      .finally(() => {
        setIsSubmitting(false)
      });
  }
  
  if (isUserLoading || isUserDocLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }
  
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
           <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.back()}>
                <ArrowLeft />
            </Button>
          <CardTitle className="text-center pt-8">Recharge Wallet</CardTitle>
          <CardDescription className="text-center">Complete payment and submit the details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <Alert>
                <AlertTitle className="font-bold">Payment Instructions</AlertTitle>
                <AlertDescription className="space-y-2">
                    <p>1. Copy the UPI ID below and pay using any UPI app (PhonePe, GPay, etc.).</p>
                    <p className="font-mono bg-muted p-2 rounded-md text-center text-sm">{UPI_ID}</p>
                    <p>2. Minimum deposit is <strong>₹{MIN_DEPOSIT}</strong>.</p>
                    <p>3. After payment, copy the Transaction ID and submit the form below.</p>
                </AlertDescription>
            </Alert>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="amount">Amount Sent</Label>
                    <Input 
                        id="amount" 
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder={`e.g. ${MIN_DEPOSIT}`}
                        min={MIN_DEPOSIT}
                        required
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="transactionId">UPI Transaction ID / Ref. No.</Label>
                    <Input 
                        id="transactionId" 
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Enter the 12-digit transaction ID"
                        required
                    />
                </div>
                 <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting Request...' : 'Submit Request'}
                </Button>
            </form>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">Your balance will be updated after we verify your payment. This may take a few minutes.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
