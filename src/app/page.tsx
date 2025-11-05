
'use client'
import { useRouter } from "next/navigation";
import { useEffect } from "react";


export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/admin/login');
  }, [router]);

  return <div className="flex items-center justify-center min-h-screen">Loading...</div>
}
