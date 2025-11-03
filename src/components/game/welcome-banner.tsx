import { Megaphone } from "lucide-react";

export default function WelcomeBanner() {
  return (
    <section className="flex items-center gap-4 p-3 rounded-lg bg-primary/20 text-primary-foreground">
      <Megaphone className="h-6 w-6 text-primary" />
      <div className="overflow-hidden">
        <p className="whitespace-nowrap animate-marquee">
          welcome to tiranga! The best color prediction game. Play and win big!
        </p>
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 15s linear infinite;
          display: inline-block;
        }
      `}</style>
    </section>
  );
}
