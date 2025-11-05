import GameArea from "@/components/game/game-area";
import GameModes from "@/components/game/game-modes";
import Header from "@/components/game/header";
import Wallet from "@/components/game/wallet";
import WelcomeBanner from "@/components/game/welcome-banner";

export default function DashboardPage() {
  return (
    <div className="min-h-screen text-white bg-background">
      <Header />
      <main className="px-4 py-4 space-y-4">
        <Wallet />
        <WelcomeBanner />
        <GameModes />
        <GameArea />
      </main>
    </div>
  );
}
