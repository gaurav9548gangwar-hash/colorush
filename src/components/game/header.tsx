"use client";

import { Headphones, History, ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between p-2 bg-background">
      <Button variant="ghost" size="icon" onClick={() => router.back()}>
        <ArrowLeft className="h-6 w-6" />
        <span className="sr-only">Back</span>
      </Button>
      <Link href="/dashboard">
        <h1 className="text-2xl font-bold text-primary">Tiranga</h1>
      </Link>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <Headphones className="h-6 w-6" />
          <span className="sr-only">Support</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => router.push('/history')}>
          <History className="h-6 w-6" />
          <span className="sr-only">History</span>
        </Button>
      </div>
    </header>
  );
}
