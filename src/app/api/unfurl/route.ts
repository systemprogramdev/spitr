import { NextRequest, NextResponse } from 'next/server'

interface OGData {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 })
  }

  try {
    // Validate URL
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SPITrBot/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 400 })
    }

    const html = await response.text()

    // Parse OG tags
    const ogData: OGData = { url }

    // Title
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
    const twitterTitle = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i)
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    ogData.title = ogTitle?.[1] || twitterTitle?.[1] || titleTag?.[1] || undefined

    // Description
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
    const twitterDesc = html.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i)
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    ogData.description = ogDesc?.[1] || twitterDesc?.[1] || metaDesc?.[1] || undefined

    // Image
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)
    const twitterImage = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']*)["']/i)
    let imageUrl = ogImage?.[1] || twitterImage?.[1]

    // Handle relative image URLs
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = new URL(imageUrl, url).href
    }
    ogData.image = imageUrl

    // Site name
    const ogSite = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i)
    ogData.siteName = ogSite?.[1] || parsedUrl.hostname

    // Decode HTML entities
    if (ogData.title) ogData.title = decodeHTMLEntities(ogData.title)
    if (ogData.description) ogData.description = decodeHTMLEntities(ogData.description)

    return NextResponse.json(ogData, {
      headers: {
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    })
  } catch (error) {
    console.error('Unfurl error:', error)
    return NextResponse.json({ error: 'Failed to unfurl' }, { status: 500 })
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}
