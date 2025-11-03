import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CountdownTimer from "./countdown-timer";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

const numberColors: { [key: number]: 'green' | 'orange' | 'white' } = {
  0: 'orange', 1: 'green', 2: 'orange', 3: 'green', 4: 'orange',
  5: 'white', 6: 'orange', 7: 'green', 8: 'orange', 9: 'green',
};

const multipliers = ['Random', 'x1', 'x5', 'x10', 'x20', 'x50', 'x100'];

export default function GameArea() {
  return (
    <Tabs defaultValue="game" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="game">Win Go 1Min</TabsTrigger>
        <TabsTrigger value="how-to-play">How to play</TabsTrigger>
      </TabsList>
      <TabsContent value="game">
        <div className="p-4 rounded-lg bg-background/30 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-bold">Time remaining</p>
              <CountdownTimer initialSeconds={60} />
            </div>
            <p className="text-sm text-gray-400">ID: 20240318011208</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="green" size="lg" className="h-12 text-lg">Green</Button>
            <Button variant="white" size="lg" className="h-12 text-lg">White</Button>
            <Button variant="orange" size="lg" className="h-12 text-lg">Orange</Button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i).map((num) => (
              <Button key={num} variant={numberColors[num]} size="circle">
                {num}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
             {multipliers.map(m => (
                <Button key={m} variant="secondary">{m}</Button>
             ))}
          </div>
          
          <div className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
            <p className="font-bold">Total: ₹10</p>
            <div className="flex items-center space-x-2">
              <Label htmlFor="big-small-toggle">Small</Label>
              <Switch id="big-small-toggle" />
              <Label htmlFor="big-small-toggle">Big</Label>
            </div>
          </div>
          <Button className="w-full h-12 text-lg">Bet</Button>
        </div>
      </TabsContent>
      <TabsContent value="how-to-play">
        <div className="p-4 rounded-lg bg-background/30 space-y-2 text-sm">
          <h3 className="font-bold">How To Play Win Go</h3>
          <p>1. Select a game duration (1, 3, 5, or 10 minutes).</p>
          <p>2. Choose to bet on a Color (Green, White, Orange), a Number (0-9), or Size (Big/Small).</p>
          <p>3. Enter your bet amount and use multipliers.</p>
          <p>4. Betting is open for the first 40 seconds. The last 20 seconds are for the result reveal.</p>
          <p className="font-bold pt-2">Payouts:</p>
          <ul className="list-disc pl-5">
            <li>Correct Color: x2 (Green/Orange), x4.5 (White)</li>
            <li>Correct Number: x9</li>
            <li>Correct Size: x2 (Big: 5-9, Small: 0-4)</li>
          </ul>
        </div>
      </TabsContent>
    </Tabs>
  );
}
