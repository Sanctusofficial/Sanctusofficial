import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
        addRandomSuffix: true,
        maximumSizeInBytes: 10 * 1024 * 1024,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('[v0] Receipt upload completed:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('[v0] Receipt upload error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    )
  }
}
