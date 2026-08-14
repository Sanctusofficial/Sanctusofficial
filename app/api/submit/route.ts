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

    // Registration data logged for now. Connect a database (e.g. Neon)
    // to persist registrations beyond this request.
    console.log('[v0] New SEES\'30 MIXER registration:', {
      name,
      email,
      departments,
      matricNumber,
      receiptUrl,
      lookingForwardTo,
      submittedAt: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Submit error:', error)
    return NextResponse.json(
      { error: 'Failed to submit registration' },
      { status: 500 },
    )
  }
}
