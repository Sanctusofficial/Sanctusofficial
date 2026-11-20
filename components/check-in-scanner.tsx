'use client'

import { useEffect, useRef, useState } from 'react'

export function CheckInScanner({ adminKey }: { adminKey: string }) {
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let controls: { stop: () => void } | undefined
    let active = true
    void import('@zxing/browser').then(async ({ BrowserQRCodeReader }) => {
      if (!active || !videoRef.current) return
      const reader = new BrowserQRCodeReader()
      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result) => {
            if (result) setToken(result.getText())
          },
        )
      } catch {
        // Manual token entry remains available when camera access is denied.
      }
    })
    return () => {
      active = false
      controls?.stop()
    }
  }, [])

  async function checkIn(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await response.json()
      setMessage(response.ok ? `Checked in ${data.ticket.name}.` : data.error ?? 'Check-in failed.')
      if (response.ok) setToken('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={checkIn} className="rounded-2xl border border-secondary/30 bg-card p-5">
      <h2 className="font-display text-xl text-secondary">Door check-in</h2>
      <p className="mt-2 text-sm text-muted-foreground">Paste the QR scanner result, or enter the ticket token manually.</p>
      <video ref={videoRef} className="mt-4 aspect-video w-full rounded-lg bg-black" muted playsInline />
      <input value={token} onChange={(e) => setToken(e.target.value)} required className="mt-4 w-full rounded-lg border bg-background p-3 font-mono" placeholder="Ticket token" />
      <button disabled={busy} className="mt-3 rounded-lg bg-secondary px-4 py-2 font-semibold text-secondary-foreground">{busy ? 'Checking...' : 'Check in'}</button>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </form>
  )
}
