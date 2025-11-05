"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GameArea from "./game-area";
import MyBetsTab from "./my-bets-tab";
import GameHistoryTab from "./game-history-tab";

export default function GameDashboard() {
  return (
    <div className="bg-card/50 rounded-lg p-2">
        <Tabs defaultValue="game" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="game">Game</TabsTrigger>
                <TabsTrigger value="past-results">Past Results</TabsTrigger>
                <TabsTrigger value="my-bets">My Bets</TabsTrigger>
            </TabsList>
            <TabsContent value="game">
                <GameArea />
            </TabsContent>
            <TabsContent value="past-results">
                <GameHistoryTab />
            </TabsContent>
            <TabsContent value="my-bets">
                <MyBetsTab />
            </TabsContent>
        </Tabs>
    </div>
  );
}
