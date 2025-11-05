'use client'
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect all users to the main login/registration page first.
    router.replace('/login');
  }, [router]);

  // This message will be shown briefly while the redirect happens.
  return <div className="flex items-center justify-center min-h-screen">Redirecting to Login...</div>
}
