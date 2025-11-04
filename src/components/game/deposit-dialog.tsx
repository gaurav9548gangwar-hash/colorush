
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
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { Copy, Loader2 } from "lucide-react";

export default function DepositDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, firestore, storage } = useFirebase();
  const UPI_ID = "colourtrest99955@ptyes";

  const handleCopy = () => {
    navigator.clipboard.writeText(UPI_ID);
    toast({
      title: "Copied!",
      description: "UPI ID has been copied to your clipboard.",
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScreenshotFile(e.target.files[0]);
    }
  };
  
  const resetForm = () => {
    setAmount('');
    setScreenshotFile(null);
    // This is a bit of a hack to reset the file input visually
    const fileInput = document.getElementById('screenshot') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore || !storage) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
      return;
    }
    if (Number(amount) < 200) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Minimum deposit is ₹200." });
      return;
    }
    if (!screenshotFile) {
      toast({ variant: "destructive", title: "Screenshot Required", description: "Please upload a payment screenshot." });
      return;
    }

    setIsSubmitting(true);

    try {
        // --- Fire and Forget Upload ---
        
        // 1. Instantly create the Firestore document with a placeholder status
        const depositsRef = collection(firestore, 'deposits');
        const newDepositDoc = await addDoc(depositsRef, {
            userId: user.uid,
            amount: Number(amount),
            status: "pending_upload", // New status: waiting for screenshot
            requestedAt: new Date().toISOString(),
            screenshotUrl: "", // Empty for now
        });

        // 2. Give instant feedback to the user and close the dialog
        toast({
            title: "Request Submitted!",
            description: "Your deposit request is being processed.",
        });
        setOpen(false);
        resetForm();
        
        // 3. Start the upload in the background (don't await it here)
        const uploadTask = async () => {
            try {
                const fileId = uuidv4();
                const storageRef = ref(storage, `deposit_screenshots/${user.uid}/${fileId}`);
                const uploadResult = await uploadBytes(storageRef, screenshotFile);
                const screenshotUrl = await getDownloadURL(uploadResult.ref);

                // 4. Update the document with the real URL and final pending status
                await updateDoc(newDepositDoc, {
                    screenshotUrl: screenshotUrl,
                    status: "pending",
                });
            } catch (uploadError) {
                console.error("Background upload failed:", uploadError);
                // Optionally update the doc to show a failure state
                await updateDoc(newDepositDoc, { status: 'upload_failed' });
            }
        };

        uploadTask(); // Fire the upload task without awaiting

    } catch (error) {
        console.error("Error submitting initial deposit request:", error);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: "Could not submit your deposit request. Please try again.",
        });
    } finally {
        setIsSubmitting(false); // Instantly reset submitting state
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
            Pay to the UPI ID below, then enter the amount, upload the screenshot, and submit your request.
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
            <div>
              <Label htmlFor="screenshot">
                Payment Screenshot
              </Label>
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
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
