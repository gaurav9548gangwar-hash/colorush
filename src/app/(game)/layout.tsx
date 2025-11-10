'use client'

import { GameEngine } from "@/components/game/game-engine";
import { useFirebase } from "@/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { User }from '@/lib/types';


export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading, firestore } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/login");
    }
  }, [isUserLoading, user, router]);

  // This effect will migrate old users' data to include the new referral fields.
  useEffect(() => {
    const migrateUserData = async () => {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            const updates: Partial<User> = {};

            // If `depositCount` is missing, initialize it.
            if (typeof userData.depositCount !== 'number') {
              updates.depositCount = 0;
            }
            
            // If `referralBonus` is missing, initialize it.
            if (typeof userData.referralBonus !== 'number') {
              updates.referralBonus = 0;
            }

            // If there are any fields to update, perform the update.
            if (Object.keys(updates).length > 0) {
              await updateDoc(userDocRef, updates);
            }
          }
        } catch (error) {
          console.error("Failed to migrate user data:", error);
        }
      }
    };

    if (!isUserLoading && user) {
      migrateUserData();
    }
  }, [user, isUserLoading, firestore]);

  if (isUserLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Authenticating...
      </div>
    );
  }

  return (
    <>
      <GameEngine />
      {children}
    </>
  );
}
