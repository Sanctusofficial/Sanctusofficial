import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

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

    // Check first, so the person gets a clear message instead of a raw database error.
    const { data: existing } = await supabase
      .from('registrations')
      .select('id')
      .or(`email.eq.${email},matric_number.eq.${matricNumber}`)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "You've already registered for SEES'30 MIXER — one spot per person!" },
        { status: 409 },
      )
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
      // Backup check: catches the rare case of two identical submissions
      // landing at the exact same moment, before the check above could catch it.
      if (dbError.code === '23505') {
        return NextResponse.json(
          { error: "You've already registered for SEES'30 MIXER — one spot per person!" },
          { status: 409 },
        )
      }
      console.error('[v0] Supabase insert error:', dbError)
      return NextResponse.json({ error: 'Failed to save registration' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Submit error:', error)
    return NextResponse.json({ error: 'Failed to submit registration' }, { status: 500 })
  }
}
