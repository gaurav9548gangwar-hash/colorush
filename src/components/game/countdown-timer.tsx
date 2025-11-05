
"use client";

import { useState, useEffect, useRef } from "react";

const BETTING_DURATION = 40; // 40 seconds for betting
const LOCKED_DURATION = 20;  // 20 seconds for result calculation
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
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_DURATION);
  const [phase, setPhase] = useState<GamePhase>("betting");
  
  // Use a ref to prevent multiple event fires for the same round
  const roundEndFiredRef = useRef(false);

  // Effect to reset the timer and state whenever a new round starts
  useEffect(() => {
    setSecondsLeft(TOTAL_DURATION);
    setPhase("betting");
    roundEndFiredRef.current = false; // Reset the flag for the new round
  }, [roundId]);

  // Main timer interval effect
  useEffect(() => {
    if (secondsLeft <= 0) {
      onNewRound(); // Start a new round when the timer hits zero
      return;
    }

    const intervalId = setInterval(() => {
      setSecondsLeft((prevSeconds) => prevSeconds - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [secondsLeft, onNewRound]);

  // Effect to handle phase changes and trigger the onRoundEnd event
  useEffect(() => {
    if (secondsLeft <= LOCKED_DURATION && phase === "betting" && !roundEndFiredRef.current) {
      setPhase("locked");
      onRoundEnd();
      roundEndFiredRef.current = true; // Mark that the event has been fired for this round
    }
  }, [secondsLeft, phase, onRoundEnd]);

  // Function to format the display time based on the current phase
  const getDisplayTime = () => {
    const secondsInPhase = phase === 'betting' ? secondsLeft - LOCKED_DURATION : secondsLeft;
    const minutes = Math.floor(secondsInPhase / 60);
    const remainingSeconds = secondsInPhase % 60;
    
    // Ensure the time is always valid and doesn't show negative numbers
    if (secondsInPhase < 0) return "00:00";

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Function to get styling based on the current phase
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
