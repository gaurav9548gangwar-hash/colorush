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
  
  const roundEndFiredRef = useRef(false);

  useEffect(() => {
    setSecondsLeft(TOTAL_DURATION);
    setPhase("betting");
    roundEndFiredRef.current = false;
  }, [roundId]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onNewRound();
      return;
    }

    const intervalId = setInterval(() => {
      setSecondsLeft((prevSeconds) => prevSeconds - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [secondsLeft, onNewRound]);

  useEffect(() => {
    if (secondsLeft <= LOCKED_DURATION && phase === "betting" && !roundEndFiredRef.current) {
      setPhase("locked");
      onRoundEnd();
      roundEndFiredRef.current = true;
    }
  }, [secondsLeft, phase, onRoundEnd]);

  const getDisplayTime = () => {
    const secondsInPhase = phase === 'betting' ? secondsLeft - LOCKED_DURATION : secondsLeft;
    const minutes = Math.floor(secondsInPhase / 60);
    const remainingSeconds = secondsInPhase % 60;
    
    if (secondsInPhase < 0) return "00:00";

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
