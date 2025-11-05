"use client";

import GameArea from "./game-area";
import MyBetsTab from "./my-bets-tab";
import GameHistoryTab from "./game-history-tab";

export default function GameDashboard() {
  return (
    <div className="bg-card/50 rounded-lg p-2 space-y-6">
      <GameArea />
      <GameHistoryTab />
      <MyBetsTab />
    </div>
  );
}
