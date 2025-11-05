import GameArea from "@/components/game/game-area";
import Header from "@/components/game/header";
import Wallet from "@/components/game/wallet";

export default function DashboardPage() {
  return (
    <div className="min-h-screen text-white">
      <Header />
      <main className="px-4 py-4 space-y-6">
        <Wallet />
        <GameArea />
      </main>
    </div>
  );
}
