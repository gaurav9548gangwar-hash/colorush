"use client";

import { useState, useEffect, useRef } from "react";

const BETTING_DURATION = 45; // 45 seconds for betting
const LOCKED_DURATION = 15;  // 15 seconds for result calculation
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
  
  // Reset timer and phase whenever a new round starts (i.e., roundId changes)
  useEffect(() => {
    setSecondsLeft(TOTAL_DURATION);
    setPhase("betting");
  }, [roundId]);

  // Main countdown interval logic
  useEffect(() => {
    // If time is up, trigger a new round and stop the timer
    if (secondsLeft <= 0) {
      onNewRound();
      return;
    }

    const intervalId = setInterval(() => {
      setSecondsLeft((prevSeconds) => {
          const newSeconds = prevSeconds - 1;
          
          // Check if it's time to lock the betting
          if (newSeconds === LOCKED_DURATION && phase === "betting") {
              setPhase("locked");
              onRoundEnd(); // Trigger the round end logic in the parent
          }

          return newSeconds;
      });
    }, 1000);

    // Cleanup interval on component unmount or when secondsLeft changes
    return () => clearInterval(intervalId);
  }, [secondsLeft, phase, onRoundEnd, onNewRound]);


  const getDisplayTime = () => {
    const secondsInPhase = phase === 'betting' ? secondsLeft - LOCKED_DURATION : secondsLeft;
    
    if (secondsInPhase < 0) return ["0","0","0","0"];

    const displaySeconds = Math.max(0, secondsInPhase);
    const minutes = Math.floor(displaySeconds / 60);
    const remainingSeconds = displaySeconds % 60;
    
    return [
        minutes.toString().padStart(2, '0').substring(0,1),
        minutes.toString().padStart(2, '0').substring(1,2),
        remainingSeconds.toString().padStart(2, '0').substring(0,1),
        remainingSeconds.toString().padStart(2, '0').substring(1,2)
    ]
  }

  const displayTime = getDisplayTime();

  return (
    <div className="flex items-center space-x-1">
        <span className="countdown-box">0</span>
        <span className="countdown-box">0</span>
        <span className="text-xl">:</span>
        <span className="countdown-box">{displayTime[2]}</span>
        <span className="countdown-box">{displayTime[3]}</span>
    </div>
  );
}
