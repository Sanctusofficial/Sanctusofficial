'use client'

import { useEffect, useState } from 'react'

function getTimeLeft(eventDate: Date) {
  const diff = Math.max(0, eventDate.getTime() - Date.now())
  return {
    over: diff === 0,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

export function Countdown({ startsAt }: { startsAt: string }) {
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft> | null>(null)

  useEffect(() => {
    const eventDate = new Date(startsAt)
    setTimeLeft(getTimeLeft(eventDate))
    const interval = setInterval(() => setTimeLeft(getTimeLeft(eventDate)), 1000)
    return () => clearInterval(interval)
  }, [startsAt])

  // Avoids a server/client mismatch on first render; hides itself once the event has started
  if (!timeLeft || timeLeft.over) return null

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
