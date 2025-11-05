
"use client";

import { useState, useEffect } from "react";

// Duration in seconds for each phase
const BETTING_DURATION = 40;
const LOCKED_DURATION = 20; // Increased to make the "locked" phase more noticeable
const RESULT_DURATION = 0; // Result phase removed, calculation happens at the end of locked phase
const TOTAL_DURATION = BETTING_DURATION + LOCKED_DURATION;

type GamePhase = "betting" | "locked" | "result";

export default function CountdownTimer({ 
  onRoundEnd,
  onNewRound,
  roundId,
}: { 
  onRoundEnd: () => void;
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
  }, [roundId]); // Reset interval when roundId changes

  useEffect(() => {
    // When timer hits 0, trigger new round logic and reset timer
    if (totalSeconds === 0) {
      onNewRound();
      setTotalSeconds(TOTAL_DURATION);
      setPhase('betting');
    }
  }, [totalSeconds, onNewRound]);


  useEffect(() => {
    // Logic to determine the current phase
    if (totalSeconds > LOCKED_DURATION) {
      setPhase("betting");
    } else { // totalSeconds <= LOCKED_DURATION
      if (phase === "betting") {
         // This is the moment the betting phase ends and locked phase begins.
         // Trigger the round end logic to calculate results immediately.
         onRoundEnd();
      }
      setPhase("locked");
    }
  }, [totalSeconds, onRoundEnd, phase]);


  const getDisplayTime = () => {
    let secondsInPhase;
    switch(phase) {
      case 'betting':
        secondsInPhase = totalSeconds - LOCKED_DURATION;
        break;
      case 'locked':
        secondsInPhase = totalSeconds;
        break;
      // Result phase is no longer displayed in the timer
      default:
        secondsInPhase = totalSeconds;
    }
    const minutes = Math.floor(secondsInPhase / 60);
    const remainingSeconds = secondsInPhase % 60;
    return `0${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  }

  const getPhaseStyles = () => {
    switch(phase) {
        case 'betting': return "text-green-400";
        case 'locked': return "text-orange-400";
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
