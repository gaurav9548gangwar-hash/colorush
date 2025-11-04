"use client";

import { useState, useEffect } from "react";
import type { GameResult } from "@/lib/types";

// Duration in seconds for each phase
const BETTING_DURATION = 40;
const LOCKED_DURATION = 15;
const RESULT_DURATION = 5;
const TOTAL_DURATION = BETTING_DURATION + LOCKED_DURATION + RESULT_DURATION;

type GamePhase = "betting" | "locked" | "result";

export default function CountdownTimer({ 
  onRoundEnd,
  onNewRound,
  roundId,
}: { 
  onRoundEnd: (result: GameResult) => void;
  onNewRound: () => void;
  roundId: string;
}) {
  const [totalSeconds, setTotalSeconds] = useState(TOTAL_DURATION);
  const [phase, setPhase] = useState<GamePhase>("betting");

  useEffect(() => {
    // Main interval for the round
    const interval = setInterval(() => {
      setTotalSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (totalSeconds <= 0) {
      onNewRound();
      setTotalSeconds(TOTAL_DURATION);
    }
  }, [totalSeconds, onNewRound]);


  useEffect(() => {
    // Logic to determine the current phase and display time
    if (totalSeconds > LOCKED_DURATION + RESULT_DURATION) {
      setPhase("betting");
    } else if (totalSeconds > RESULT_DURATION) {
      setPhase("locked");
    } else {
      if (phase !== "result") {
         // Generate result only when transitioning to the result phase
         const resultNumber = Math.floor(Math.random() * 10);
         const resultColor = ['green', 'orange', 'white'][Math.floor(Math.random() * 3)] as 'green' | 'orange' | 'white';
         onRoundEnd({
            id: roundId,
            gameId: roundId, 
            resultNumber,
            resultColor
         });
      }
      setPhase("result");
    }
  }, [totalSeconds, onRoundEnd, phase, roundId]);


  const getDisplayTime = () => {
    let secondsInPhase;
    switch(phase) {
      case 'betting':
        secondsInPhase = totalSeconds - (LOCKED_DURATION + RESULT_DURATION);
        break;
      case 'locked':
        secondsInPhase = totalSeconds - RESULT_duration;
        break;
      case 'result':
        secondsInPhase = totalSeconds;
        break;
      default:
        secondsInPhase = 0;
    }
    const minutes = Math.floor(secondsInPhase / 60);
    const remainingSeconds = secondsInPhase % 60;
    return `0${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  }

  const getPhaseStyles = () => {
    switch(phase) {
        case 'betting': return "text-green-400";
        case 'locked': return "text-orange-400";
        case 'result': return "text-red-500";
        default: return "text-white";
    }
  }

  return (
    <div>
        <p className="text-sm text-gray-400 capitalize">{phase}</p>
        <p className={`text-3xl font-bold ${getPhaseStyles()}`}>
            {getDisplayTime()}
        </p>
    </div>
  );
}
