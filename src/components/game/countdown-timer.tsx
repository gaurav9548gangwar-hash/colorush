
"use client";

import { useState, useEffect } from "react";

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

  // Effect to reset the timer whenever a new round starts (i.e., roundId changes).
  useEffect(() => {
    setTotalSeconds(TOTAL_DURATION);
    setPhase("betting");
  }, [roundId]);

  // Main timer interval.
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [roundId]); 

  // Effect to handle phase transitions and event emissions.
  useEffect(() => {
    if (totalSeconds === 0) {
      onNewRound();
    } else if (totalSeconds <= LOCKED_DURATION) {
      if (phase === "betting") {
        onRoundEnd();
        setPhase("locked");
      }
    } else {
       setPhase("betting");
    }
  }, [totalSeconds, phase, onRoundEnd, onNewRound]);


  const getDisplayTime = () => {
    let secondsInPhase;
    if (phase === 'betting') {
        secondsInPhase = totalSeconds - LOCKED_DURATION;
    } else {
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
