'use client'

import { useEffect, useState } from 'react'

// EDIT THIS if your event date/time changes
const EVENT_DATE = new Date('2026-08-31T12:00:00+01:00')

function getTimeLeft() {
  const diff = Math.max(0, EVENT_DATE.getTime() - Date.now())
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

export function Countdown() {
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft> | null>(null)

  useEffect(() => {
    setTimeLeft(getTimeLeft())
    const interval = setInterval(() => setTimeLeft(getTimeLeft()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Avoids a server/client mismatch on first render
  if (!timeLeft) return null

  return (
    <div className="countdown">
      <div className="countdown-unit">
        <div className="value">{timeLeft.days}</div>
        <div className="label">Days</div>
      </div>
      <div className="countdown-unit">
        <div className="value">{timeLeft.hours}</div>
        <div className="label">Hrs</div>
      </div>
      <div className="countdown-unit">
        <div className="value">{timeLeft.minutes}</div>
        <div className="label">Min</div>
      </div>
      <div className="countdown-unit">
        <div className="value">{timeLeft.seconds}</div>
        <div className="label">Sec</div>
      </div>
    </div>
  )
}
