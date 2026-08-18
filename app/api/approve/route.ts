import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL, approvalEmailHtml } from '@/lib/resend'

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

export async function POST(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { data: registrant, error: fetchError } = await supabase
      .from('registrations')
      .select('name, email, status')
      .eq('id', id)
      .single()

    if (fetchError || !registrant) {
      return NextResponse.json({ error: 'Registrant not found' }, { status: 404 })
    }

    if (registrant.status === 'approved') {
      return NextResponse.json({ error: 'Already approved' }, { status: 409 })
    }

    const { error: updateError } = await supabase
      .from('registrations')
      .update({ status: 'approved' })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 502 })
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: registrant.email,
      subject: "You're confirmed — SEES'30 MIXER",
      html: approvalEmailHtml(registrant.name),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Approve error:', error)
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
  }
}