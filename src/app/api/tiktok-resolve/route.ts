import { NextRequest, NextResponse } from 'next/server'

// Cache resolved TikTok video IDs for 24 hours
const cache = new Map<string, { videoId: string; expiresAt: number }>()

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  // Check cache
  const cached = cache.get(url)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ videoId: cached.videoId })
  }

  try {
    // Follow redirects to get the final URL
    const res = await fetch(url, { redirect: 'follow' })
    const finalUrl = res.url

    // Extract video ID from final URL: /video/1234567890
    const match = finalUrl.match(/\/video\/(\d+)/)
    if (!match) {
      return NextResponse.json({ error: 'Could not extract video ID' }, { status: 400 })
    }

    const videoId = match[1]

    // Cache for 24 hours
    cache.set(url, { videoId, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })

    return NextResponse.json({ videoId })
  } catch {
    return NextResponse.json({ error: 'Failed to resolve URL' }, { status: 500 })
  }
}
