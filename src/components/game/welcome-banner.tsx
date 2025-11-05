"use client";

import { Megaphone } from "lucide-react";

export default function WelcomeBanner() {
  return (
    <section className="flex items-center gap-2 p-2 rounded-lg bg-primary/20 text-primary-foreground">
      <Megaphone className="h-5 w-5 text-white flex-shrink-0" />
      <div className="overflow-hidden flex-grow">
        <p className="whitespace-nowrap animate-marquee text-sm">
          welcome to tiranga!
        </p>
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-150%); }
        }
        .animate-marquee {
          animation: marquee 10s linear infinite;
          display: inline-block;
        }
      `}</style>
    </section>
  );
}
