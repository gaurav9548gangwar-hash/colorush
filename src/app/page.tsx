'use client'
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Always redirect to the admin login page to show the admin panel.
    router.replace('/admin/login');
  }, [router]);

  // This message will be shown briefly while the redirect happens.
  return <div className="flex items-center justify-center min-h-screen">Redirecting to Admin Panel...</div>
}
