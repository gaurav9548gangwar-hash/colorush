"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection } from "firebase/firestore";
import type { User } from "@/lib/types";

export default function WithdrawDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [upi, setUpi] = useState('');
  const { toast } = useToast();
  const { user, firestore, isUserLoading, userError } = useFirebase();
  const userData = (user as unknown as { data: User })?.data;

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
        const currentBalance = (user as any)?.balance ?? 0;
        if (currentBalance < 500) {
            toast({
                variant: 'destructive',
                title: 'Insufficient Balance',
                description: 'You need at least ₹500 in your wallet to make a withdrawal request.',
            });
            return;
        }
    }
    setOpen(isOpen);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to make a withdrawal.",
      });
      return;
    }
     if (Number(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount.",
      });
      return;
    }
    
    const currentBalance = (user as any)?.balance ?? 0;
    if (Number(amount) > currentBalance) {
        toast({
            variant: "destructive",
            title: "Insufficient Balance",
            description: "The withdrawal amount cannot be more than your wallet balance.",
        });
        return;
    }


    try {
      const withdrawalsRef = collection(firestore, `withdrawals`);
      await addDocumentNonBlocking(withdrawalsRef, {
        userId: user.uid,
        amount: Number(amount),
        upiBank: upi,
        status: "pending",
        requestedAt: new Date().toISOString(),
      });

      toast({
        title: "Request Submitted",
        description: "Your withdrawal request is being processed.",
      });
      setOpen(false);
      setAmount('');
      setUpi('');
    } catch (error) {
       console.error("Error submitting withdrawal request:", error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Could not submit your withdrawal request. Please try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" className="w-full">Withdraw</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
          <DialogDescription>
            Enter the amount and your UPI ID to request a withdrawal. Minimum balance of ₹500 is required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="₹500"
                className="col-span-3"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="upi" className="text-right">
                UPI ID
              </Label>
              <Input
                id="upi"
                placeholder="yourname@upi"
                className="col-span-3"
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Submit Request</Button>          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
