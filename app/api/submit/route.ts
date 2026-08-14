import { NextResponse } from 'next/server'

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
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    const submittedAt = new Date().toISOString()

    console.log('[v0] New SEES\'30 MIXER registration:', {
      name,
      email,
      departments,
      matricNumber,
      receiptUrl,
      lookingForwardTo,
      submittedAt,
    })

    const webhookUrl = process.env.SHEETS_WEBHOOK_URL
    const webhookSecret = process.env.SHEETS_SECRET

    if (!webhookUrl || !webhookSecret) {
      console.error('[v0] Missing SHEETS_WEBHOOK_URL or SHEETS_SECRET env var')
      return NextResponse.json(
        { error: 'Registration storage is not configured' },
        { status: 500 },
      )
    }

    const sheetsResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: webhookSecret,
        name,
        email,
        departments: departments.join(', '),
        matricNumber,
        receiptUrl,
        lookingForwardTo,
        submittedAt,
      }),
    })

    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text().catch(() => '')
      console.error('[v0] Sheets webhook failed:', sheetsResponse.status, errorText)
      return NextResponse.json(
        { error: 'Failed to save registration' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Submit error:', error)
    return NextResponse.json(
      { error: 'Failed to submit registration' },
      { status: 500 },
    )
  }
}
