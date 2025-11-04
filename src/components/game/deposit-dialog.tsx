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
import { Copy } from "lucide-react";

export default function DepositDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
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
    
    if (Number(amount) < 200) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Minimum deposit amount is ₹200.",
      });
      return;
    }

    try {
      const depositsRef = collection(firestore, `deposits`);
      await addDocumentNonBlocking(depositsRef, {
        userId: user.uid,
        amount: Number(amount),
        status: "pending",
        requestedAt: new Date().toISOString(),
        // In a real app, you would upload the screenshot and save the URL
        screenshotUrl: "https://via.placeholder.com/150", 
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
            Pay to the UPI ID below, then enter the amount and submit your request.
            Minimum deposit is ₹200.
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
             {/* We will add screenshot upload functionality in a future step */}
            <p className="text-xs text-center text-muted-foreground pt-2">
                After submitting, your request will be reviewed by our team.
            </p>
          <DialogFooter>
            <Button type="submit">Submit Request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
