
'use client'

import { GameEngine } from "@/components/game/game-engine";
import { useFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/login");
    }
  }, [isUserLoading, user, router]);

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
