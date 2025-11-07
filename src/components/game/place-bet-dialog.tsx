
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import type { Bet, BetColor, BetSize, BetTarget, User } from '@/lib/types'
import { cn } from '@/lib/utils'
import { doc, getDoc, increment, writeBatch, collection, serverTimestamp, addDoc } from 'firebase/firestore'
import { FirestorePermissionError } from '@/firebase/errors'
import { errorEmitter } from '@/firebase/error-emitter'

interface PlaceBetDialogProps {
  type: 'color' | 'number' | 'size'
  target: BetTarget
  roundId: string
  disabled: boolean
}

const amountPresets = [10, 20, 50, 100]

export function PlaceBetDialog({ type, target, roundId, disabled }: PlaceBetDialogProps) {
  const { firestore, user } = useFirebase()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(10)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getButtonVariant = () => {
    if (type === 'color') {
      const color = target as BetColor
      if (color === 'green') return 'green'
      if (color === 'orange') return 'orange'
      if (color === 'white') return 'white'
    }
     if (type === 'number') {
        const num = target as number;
        if ([0, 5].includes(num)) return 'white';
        if ([1, 3, 7, 9].includes(num)) return 'green';
        if ([2, 4, 6, 8].includes(num)) return 'orange';
    }
    if (type === 'size') {
        const size = target as BetSize;
        if (size === 'small') return 'blue';
        if (size === 'big') return 'yellow';
    }
    return 'secondary'
  }

  const handlePlaceBet = async () => {
    if (!user || !roundId || !firestore) {
      toast({ variant: 'destructive', title: 'Invalid Bet', description: 'Please log in to place a bet.' })
      return
    }
     if (amount < 10) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Minimum bet amount is INR 10.' });
      return;
    }

    setIsSubmitting(true)
    
    const userRef = doc(firestore, 'users', user.uid);
    const betsCollectionRef = collection(firestore, 'bets');

    try {
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error("User data not found.");
      }
      
      const userData = userDoc.data() as User;
      const currentBalance = userData.balance || 0;
      const currentWinningsBalance = userData.winningsBalance || 0;

      if ((currentBalance + currentWinningsBalance) < amount) {
        toast({ variant: 'destructive', title: 'Insufficient Balance', description: `Your total balance is too low. You need at least INR ${amount}.` });
        setIsSubmitting(false);
        setOpen(false);
        return;
      }
      
      const batch = writeBatch(firestore);
      
      // New logic: Deduct from main balance first, then from winnings if necessary.
      const deductionFromMain = Math.min(currentBalance, amount);
      const remainingAmount = amount - deductionFromMain;
      const deductionFromWinnings = Math.min(currentWinnings, remainingAmount);

      let balanceUpdate = {};
      if (deductionFromMain > 0 && deductionFromWinnings > 0) {
          balanceUpdate = { balance: increment(-deductionFromMain), winningsBalance: increment(-deductionFromWinnings) };
      } else if (deductionFromMain > 0) {
          balanceUpdate = { balance: increment(-deductionFromMain) };
      } else if (deductionFromWinnings > 0) {
          balanceUpdate = { winningsBalance: increment(-deductionFromWinnings) };
      }

      batch.update(userRef, balanceUpdate);
      
      const newBetRef = doc(betsCollectionRef); 
      const betData: Bet = {
        id: newBetRef.id,
        userId: user.uid,
        roundId,
        amount,
        target,
        type,
        status: 'pending',
        payout: 0,
        createdAt: serverTimestamp(),
      }
      batch.set(newBetRef, betData);

      await batch.commit();

      toast({ title: 'Bet Placed!', description: `You bet INR ${amount} on ${target}. Good luck!` })
      setOpen(false)

    } catch (error: any) {
        const contextualError = new FirestorePermissionError({
            path: error.message.includes("User data not found") ? userRef.path : 'bets',
            operation: error.message.includes("User data not found") ? 'get' : 'create',
            requestResourceData: { betAmount: amount },
        });
        errorEmitter.emit('permission-error', contextualError);
        
        toast({ 
          variant: 'destructive', 
          title: 'Error Placing Bet', 
          description: error.message === "User data not found." ? error.message : 'Could not place your bet. Please check permissions.'
        })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={getButtonVariant()} disabled={disabled} className="w-full h-12 text-lg font-bold">
          {type === 'number' ? `${target}x` : String(target)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Place Bet on <span className={cn('capitalize', type === 'color' && `text-${target}-500`)}>{String(target)}</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Label htmlFor="amount">Bet Amount (INR)</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min="10"
            step="10"
          />
          <div className="flex justify-between gap-2">
            {amountPresets.map(preset => (
              <Button key={preset} variant="outline" onClick={() => setAmount(preset)}>
                {preset}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handlePlaceBet} disabled={isSubmitting}>
            {isSubmitting ? 'Placing Bet...' : `Bet INR ${amount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
