"use client";

import { useState, useEffect } from "react";

export default function CountdownTimer({ initialSeconds }: { initialSeconds: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) return;

    const interval = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [seconds]);

  useEffect(() => {
    // Reset timer for a new round
    if (seconds === 0) {
      setTimeout(() => setSeconds(initialSeconds), 2000); // 2s delay before new round
    }
  }, [seconds, initialSeconds]);

  const bettingPhase = seconds > 20;
  const displaySeconds = seconds > 0 ? seconds - (bettingPhase ? 20 : 0) : 0;
  
  const minutes = Math.floor(displaySeconds / 60);
  const remainingSeconds = displaySeconds % 60;

  return (
    <p className={`text-3xl font-bold ${bettingPhase ? "text-green-400" : "text-orange-400"}`}>
      0{minutes}:{remainingSeconds < 10 ? "0" : ""}{remainingSeconds}
    </p>
  );
}
