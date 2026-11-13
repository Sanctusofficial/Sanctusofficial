import { notFound } from 'next/navigation'
import QRCode from 'qrcode'

import { getTicket } from '@/lib/passport'

export const dynamic = 'force-dynamic'

export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const ticket = await getTicket(token)
  if (!ticket || ticket.status !== 'approved') notFound()

  const qr = await QRCode.toDataURL(token, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: { dark: '#14001f', light: '#ffffff' },
  })
  const event = ticket.event

  return (
    <main className="min-h-screen px-4 py-12">
      <section className="mx-auto max-w-md rounded-3xl border border-primary/40 bg-card p-6 text-center shadow-[0_0_40px_oklch(0.73_0.24_355_/_18%)]">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">SEES&apos;30 passport</p>
        <h1 className="mt-4 font-display text-3xl text-primary text-glow-pink">{event?.title ?? ticket.event_slug}</h1>
        <p className="mt-2 text-muted-foreground">{ticket.name}</p>
        <div className="mx-auto my-6 w-fit rounded-2xl bg-white p-3">
          {/* This token is private; only show it on the ticket route. */}
          <img src={qr} alt="Private event entry QR code" width={320} height={320} />
        </div>
        <p className="text-sm text-muted-foreground">Show this code at the door. It can only be used once.</p>
        {event?.starts_at && (
          <p className="mt-4 text-sm">
            {new Date(event.starts_at).toLocaleString('en-NG', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Africa/Lagos',
            })}
          </p>
        )}
      </section>
    </main>
  )
}
