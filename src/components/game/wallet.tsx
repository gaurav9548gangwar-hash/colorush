"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import DepositDialog from "./deposit-dialog";
import WithdrawDialog from "./withdraw-dialog";
import { useDoc, useFirebase, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import type { User } from "@/lib/types";

export default function Wallet() {
  const { user, firestore } = useFirebase();

  const userRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userData, isLoading: isUserLoading } = useDoc<User>(userRef);

  return (
    <section className="p-4 rounded-lg bg-primary/20 space-y-4">
      <div>
        <p className="text-sm text-gray-300">Wallet Balance</p>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">₹{isUserLoading ? '...' : userData?.balance?.toFixed(2) ?? '0.00'}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <WithdrawDialog />
        <DepositDialog />
      </div>
    </section>
  );
}
