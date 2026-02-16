import { NextRequest, NextResponse } from 'next/server'

interface TikTokOEmbed {
  title: string
  author_name: string
  thumbnail_url: string
}

// Cache oEmbed results for 24 hours
const cache = new Map<string, { data: TikTokOEmbed; expiresAt: number }>()

// Resolve short URLs (vm.tiktok.com) to full canonical URLs
async function resolveUrl(url: string): Promise<string> {
  try {
    const u = new URL(url)
    if (u.hostname === 'vm.tiktok.com') {
      const res = await fetch(url, { redirect: 'follow' })
      return res.url
    }
  } catch {}
  return url
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  // Check cache
  const cached = cache.get(url)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  try {
    // Resolve short URLs before calling oEmbed
    const canonicalUrl = await resolveUrl(url)

    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`
    const res = await fetch(oembedUrl)
    if (!res.ok) throw new Error('oEmbed fetch failed')

    const json = await res.json()
    const data: TikTokOEmbed = {
      title: json.title || '',
      author_name: json.author_name || '',
      thumbnail_url: json.thumbnail_url || '',
    }

    cache.set(url, { data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch TikTok data' }, { status: 500 })
  }
}
