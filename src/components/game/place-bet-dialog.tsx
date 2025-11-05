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
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import type { BetColor, BetSize, BetTarget } from '@/lib/types'
import { cn } from '@/lib/utils'

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
    return 'secondary'
  }

  const handlePlaceBet = async () => {
    if (!firestore || !user || !roundId || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Bet', description: 'Please enter a valid amount.' })
      return
    }
    setIsSubmitting(true)
    try {
      await addDoc(collection(firestore, 'bets'), {
        userId: user.uid,
        roundId,
        amount,
        target,
        type,
        status: 'pending',
        payout: 0,
        createdAt: serverTimestamp(),
      })
      toast({ title: 'Bet Placed!', description: `You bet ₹${amount} on ${target}.` })
      setOpen(false)
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Placing Bet', description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={getButtonVariant()} disabled={disabled} className="w-full h-12 text-lg font-bold">
          {String(target)}
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
            {isSubmitting ? 'Placing Bet...' : `Bet ₹${amount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
