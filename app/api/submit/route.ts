import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { name, email, departments, matricNumber, receiptUrl, lookingForwardTo } = data

    if (
      !name ||
      !email ||
      !Array.isArray(departments) ||
      departments.length === 0 ||
      !matricNumber ||
      !receiptUrl ||
      !lookingForwardTo
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error: dbError } = await supabase.from('registrations').insert({
      name,
      email,
      departments: departments.join(', '),
      matric_number: matricNumber,
      receipt_url: receiptUrl,
      looking_forward_to: lookingForwardTo,
    })

    if (dbError) {
      console.error('[v0] Supabase insert error:', dbError)
      return NextResponse.json({ error: 'Failed to save registration' }, { status: 502 })
    }

    // Registration is already safely stored — an email hiccup shouldn't fail the whole request.
    const { error: emailError } = await resend.emails.send({
      from: "SEES'30 MIXER <onboarding@resend.dev>",
      to: email,
      subject: "You're in! SEES'30 MIXER",
      html: `<p>Hey ${name},</p>
<p>Your spot at <strong>SEES'30 MIXER</strong> is locked in ✅</p>
<p>📅 29th August<br/>🕛 12PM</p>
<p>Unwind after shege — pull up with your gang.</p>
<p>See you there!<br/>SEES'30</p>`,
    })

    if (emailError) {
      console.error('[v0] Resend email error:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Submit error:', error)
    return NextResponse.json({ error: 'Failed to submit registration' }, { status: 500 })
  }
}
