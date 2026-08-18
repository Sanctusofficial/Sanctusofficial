import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL = "SEES'30 MIXER <onboarding@resend.dev>"
// ⚠️ Once you verify your own domain on Resend, change this to
// something like "SEES'30 MIXER <hello@yourdomain.com>"

export function confirmationEmailHtml(name: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2>You're on the list, ${name}! 🛸</h2>
      <p>Thanks for registering for <strong>SEES'30 MIXER</strong>.</p>
      <p>We've received your registration and payment receipt. Our team will verify it shortly, and you'll get a second email once you're fully confirmed.</p>
      <p>See you there — 31st August, 12PM.</p>
    </div>
  `
}

export function approvalEmailHtml(name: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2>You're confirmed, ${name}! ✅</h2>
      <p>Your spot for <strong>SEES'30 MIXER</strong> is locked in.</p>
      <p>Picnic, outdoor games, good music, and meet & greet — 31st August, 12PM. Pull up with your gang!</p>
    </div>
  `
}