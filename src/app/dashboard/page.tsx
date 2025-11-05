import GameDashboard from "@/components/game/game-dashboard";
import Header from "@/components/game/header";
import Wallet from "@/components/game/wallet";

export default function DashboardPage() {
  return (
    <div className="min-h-screen text-white bg-background">
      <Header />
      <main className="px-4 py-4 space-y-4">
        <Wallet />
        <GameDashboard />
      </main>
    </div>
  );
}
