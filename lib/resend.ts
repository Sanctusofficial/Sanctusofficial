import { Resend } from 'resend'

// Created when needed, not when the file loads, so a build without the key doesn't crash.
let client: Resend | null = null
export function getResend() {
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

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

export function approvalEmailHtml(name: string, eventTitle = "SEES'30 MIXER") {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2>You're confirmed, ${name}! ✅</h2>
      <p>Your spot for <strong>${eventTitle}</strong> is locked in.</p>
      <p>Picnic, outdoor games, good music, and meet & greet. Pull up with your gang!</p>
    </div>
  `
}