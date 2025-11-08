
'use client'

import { useState, useEffect } from 'react'
import { useGameStore } from '@/lib/game-store';

const TOTAL_DURATION = 60 // 1 minute
const BETTING_DURATION = 55
export const LOCKED_DURATION = TOTAL_DURATION - BETTING_DURATION

export function CountdownTimer() {
  const { currentRoundId } = useGameStore();
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_DURATION)
  const [phase, setPhase] = useState<'betting' | 'locked'>('betting')

  useEffect(() => {
    // This effect now simply resets the timer UI when the global roundId changes.
    setSecondsLeft(TOTAL_DURATION)
    setPhase('betting')
  }, [currentRoundId])

  useEffect(() => {
    // This effect is purely for the UI countdown.
    if (secondsLeft <= 0) {
      // The GameEngine will handle starting a new round.
      return;
    }

    const intervalId = setInterval(() => {
        setSecondsLeft((prevSeconds) => {
            const newSeconds = prevSeconds - 1;
            
            if (newSeconds <= LOCKED_DURATION && phase === "betting") {
                setPhase("locked");
            }
            return newSeconds;
        });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [secondsLeft, phase]);


  const displaySeconds = phase === 'betting' ? secondsLeft - LOCKED_DURATION : secondsLeft
  const formattedTime = `00:${String(displaySeconds).padStart(2, '0')}`

  return (
    <div className="text-center">
      <p className="text-sm uppercase tracking-wider text-muted-foreground">
        {phase === 'betting' ? 'Time Remaining' : 'Result Soon'}
      </p>
      <p className={`text-4xl font-bold ${phase === 'locked' ? 'text-destructive' : 'text-foreground'}`}>
        {formattedTime}
      </p>
    </div>
  )
}
