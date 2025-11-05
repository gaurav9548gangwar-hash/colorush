

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
import { useFirebase } from "@/firebase";
import { collection, addDoc } from "firebase/firestore";
import { Copy, Loader2 } from "lucide-react";

export default function DepositDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, firestore } = useFirebase();
  const UPI_ID = "colourtrest99955@ptyes";

  const handleCopy = () => {
    navigator.clipboard.writeText(UPI_ID);
    toast({
      title: "Copied!",
      description: "UPI ID has been copied to your clipboard.",
    });
  };

  const resetForm = () => {
    setAmount('');
    setTransactionId('');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
      return;
    }
    if (Number(amount) < 200) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Minimum deposit is INR 200." });
      return;
    }
    if (!transactionId.trim()) {
      toast({ variant: "destructive", title: "Transaction ID Required", description: "Please enter the payment transaction ID." });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await addDoc(collection(firestore, 'deposits'), {
        userId: user.uid,
        amount: Number(amount),
        status: "pending",
        requestedAt: new Date().toISOString(),
        transactionId: transactionId, 
      });

      toast({
          title: "Request Submitted!",
          description: "Your deposit is being processed. You can check the status in your history.",
      });
      
      setOpen(false);
      resetForm();

    } catch (error) {
      console.error("Error submitting deposit request:", error);
      toast({
          variant: "destructive",
          title: "Submission Failed",
          description: "Could not submit your deposit request. Please check your connection and try again.",
      });
    } finally {
        setIsSubmitting(false); 
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
            Pay to the UPI ID below, then enter the amount and Transaction ID (UTR/Ref ID) to submit your request.
            Minimum deposit is INR 200.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
            <Label>Our UPI ID</Label>
            <div className="flex items-center space-x-2">
                <Input type="text" value={UPI_ID} readOnly />
                <Button type="button" size="icon" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">Click the button to copy the UPI ID.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="amount">
                Amount Deposited
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount paid"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="transactionId">
                Payment Transaction ID (UTR/Ref ID)
              </Label>
              <Input
                id="transactionId"
                type="text"
                placeholder="Enter the 12-digit transaction ID"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-center text-muted-foreground pt-2">
                After submitting, your request will be reviewed by our team.
            </p>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
