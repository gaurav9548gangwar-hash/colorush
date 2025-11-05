
'use client'
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFirebase } from "@/firebase";


export default function Home() {
  const router = useRouter();
  const { user, isUserLoading } = useFirebase();

  useEffect(() => {
    if (!isUserLoading) {
        if (user) {
            router.push('/dashboard');
        } else {
            router.push('/login');
        }
    }
  }, [router, user, isUserLoading]);

  return <div className="flex items-center justify-center min-h-screen">Loading...</div>
}
