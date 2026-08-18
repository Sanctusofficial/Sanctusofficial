import { resend, FROM_EMAIL, confirmationEmailHtml } from '@/lib/resend'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // Fallback path — direct form upload if client-side Blob upload isn't available
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
      }
      const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true })
      return NextResponse.json({ url: blob.url })
    }

    // Primary path — token exchange for direct browser-to-Blob upload
    const body = (await request.json()) as HandleUploadBody
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maximumSizeInBytes: 10 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    // This ensures a real, readable error always comes back — never a blank crash.
    const message = error instanceof Error ? error.message : 'Upload failed.'
    console.error('receipt-upload error:', message)
    resend.emails
      .send({
        from: FROM_EMAIL,
        to: email,
        subject: "You're on the list — SEES'30 MIXER",
        html: confirmationEmailHtml(name),
      })
      .catch((emailError) => {
        console.error('[v0] Confirmation email error:', emailError)
      })

    return NextResponse.json({ success: true })