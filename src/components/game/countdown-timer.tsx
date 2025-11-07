'use client'

import { useState, useEffect } from 'react'

const TOTAL_DURATION = 60 // 1 minute
const BETTING_DURATION = 55
export const LOCKED_DURATION = TOTAL_DURATION - BETTING_DURATION

interface CountdownTimerProps {
  roundId: string
  onRoundEnd: () => void
  onNewRound: () => void
}

export function CountdownTimer({ roundId, onRoundEnd, onNewRound }: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_DURATION)
  const [phase, setPhase] = useState<'betting' | 'locked'>('betting')

  useEffect(() => {
    setSecondsLeft(TOTAL_DURATION)
    setPhase('betting')
  }, [roundId])

  useEffect(() => {
    if (secondsLeft <= 0) {
      onNewRound()
      return
    }

    const intervalId = setInterval(() => {
        setSecondsLeft((prevSeconds) => {
            const newSeconds = prevSeconds - 1;
            
            if (newSeconds === LOCKED_DURATION && phase === "betting") {
                setPhase("locked");
            }
            return newSeconds;
        });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [secondsLeft, onNewRound, phase]);

  useEffect(() => {
    if (phase === "locked" && secondsLeft === LOCKED_DURATION) {
      onRoundEnd();
    }
  }, [phase, secondsLeft, onRoundEnd]);

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
