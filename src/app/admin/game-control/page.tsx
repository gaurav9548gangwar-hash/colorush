
import { GameControlTab } from "../components";

export default function AdminGameControlPage() {
  return (
    <div className="p-4 md:p-6 text-foreground">
      <h1 className="text-3xl font-bold mb-6">Game Control</h1>
      <GameControlTab />
    </div>
  );
}
