import { Headphones, Moon } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";

export default function Header() {
  return (
    <header className="flex items-center justify-between p-4 bg-background/30">
      <Link href="/dashboard">
        <h1 className="text-2xl font-bold text-primary">Tiranga</h1>
      </Link>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Headphones className="h-6 w-6" />
          <span className="sr-only">Support</span>
        </Button>
        <Button variant="ghost" size="icon">
          <Moon className="h-6 w-6" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
