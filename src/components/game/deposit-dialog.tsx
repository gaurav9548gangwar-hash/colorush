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
import Image from 'next/image';
import { useFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection } from "firebase/firestore";

export default function DepositDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const { toast } = useToast();
  const { user, firestore } = useFirebase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to make a deposit.",
      });
      return;
    }
    
    if (Number(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount.",
      });
      return;
    }

    try {
      const depositsRef = collection(firestore, `users/${user.uid}/deposits`);
      await addDocumentNonBlocking(depositsRef, {
        userId: user.uid,
        amount: Number(amount),
        status: "pending",
        requestedAt: new Date().toISOString(),
      });

      toast({
        title: "Request Submitted",
        description: "Your deposit request is being processed. It will reflect in your wallet upon approval.",
      });
      setOpen(false);
      setAmount('');
    } catch (error) {
      console.error("Error submitting deposit request:", error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Could not submit your deposit request. Please try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">Deposit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Make a Deposit</DialogTitle>
          <DialogDescription>
            Scan the QR code to pay, then enter the amount below and submit your request.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
            <Image 
                src="https://picsum.photos/seed/qr/250/250"
                alt="QR Code for payment"
                width={250}
                height={250}
                data-ai-hint="qr code"
            />
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount paid"
                className="col-span-3"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Submit Request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
