import { Clock } from "lucide-react";
import { Button } from "../ui/button";

const gameModes = [
  { name: "Win Go 1Min", time: 1 },
  { name: "Win Go 3Min", time: 3 },
  { name: "Win Go 5Min", time: 5 },
  { name: "Win Go 10Min", time: 10 },
];

export default function GameModes() {
  return (
    <section>
      <div className="grid grid-cols-4 gap-2 text-center">
        {gameModes.map((mode, index) => (
          <Button
            key={mode.name}
            variant={index === 0 ? "default" : "secondary"}
            className="flex flex-col items-center justify-center h-20 rounded-lg bg-primary/20 text-white"
          >
            <Clock className="h-6 w-6 mb-1" />
            <span className="text-xs font-semibold">{mode.name}</span>
          </Button>
        ))}
      </div>
    </section>
  );
}
