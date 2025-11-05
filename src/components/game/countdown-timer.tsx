
"use client";

import { useState, useEffect } from "react";

// Duration in seconds for each phase
const BETTING_DURATION = 40;
const LOCKED_DURATION = 20;
const TOTAL_DURATION = BETTING_DURATION + LOCKED_DURATION;

type GamePhase = "betting" | "locked";

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

  // This effect resets the timer whenever a new round starts (i.e., roundId changes).
  useEffect(() => {
    setTotalSeconds(TOTAL_DURATION);
    setPhase("betting");
  }, [roundId]);

  // This is the main timer interval.
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [roundId]); // It also resets if the roundId changes.

  // This effect handles phase transitions and event emissions.
  useEffect(() => {
    // When the timer hits 0, it triggers the start of a new round.
    if (totalSeconds === 0) {
      onNewRound();
    } else if (totalSeconds <= LOCKED_DURATION) {
      // When the timer enters the locked duration...
      if (phase === "betting") {
        // And if the *previous* phase was 'betting', it means we just transitioned.
        // This is the precise moment to trigger the end-of-round logic.
        onRoundEnd();
      }
      setPhase("locked");
    } else {
      // Any other time, it's the betting phase.
      setPhase("betting");
    }
  }, [totalSeconds, phase, onRoundEnd, onNewRound]);


  const getDisplayTime = () => {
    let secondsInPhase;
    switch(phase) {
      case 'betting':
        // Shows time remaining in the betting phase
        secondsInPhase = totalSeconds - LOCKED_DURATION;
        break;
      case 'locked':
        // Shows time remaining until the next round starts
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
