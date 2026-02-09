import { NextRequest, NextResponse } from 'next/server'

interface OGData {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
}

// Extract content from a meta tag, handling both attribute orderings:
// <meta property="og:title" content="value"> AND <meta content="value" property="og:title">
function getMetaContent(html: string, attrName: string, attrValue: string): string | undefined {
  // Pattern 1: property/name before content
  const p1 = new RegExp(
    `<meta[^>]*${attrName}=["']${attrValue}["'][^>]*content=["']([^"']*)["']`,
    'i'
  )
  // Pattern 2: content before property/name
  const p2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attrName}=["']${attrValue}["']`,
    'i'
  )
  return html.match(p1)?.[1] || html.match(p2)?.[1] || undefined
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

    // Try fetching with different User-Agents (some sites block bots)
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ]

    let response: Response | null = null
    for (const ua of userAgents) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          response = res
          break
        }
      } catch {
        continue
      }
    }

    if (!response) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 400 })
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml') && !contentType.includes('text/xml')) {
      return NextResponse.json({ error: 'Not an HTML page' }, { status: 400 })
    }

    const html = await response.text()

    // Parse OG tags (handles both attribute orderings)
    const ogData: OGData = { url }

    // Title
    const ogTitle = getMetaContent(html, 'property', 'og:title')
    const twitterTitle = getMetaContent(html, 'name', 'twitter:title')
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
    ogData.title = ogTitle || twitterTitle || titleTag || undefined

    // Description
    const ogDesc = getMetaContent(html, 'property', 'og:description')
    const twitterDesc = getMetaContent(html, 'name', 'twitter:description')
    const metaDesc = getMetaContent(html, 'name', 'description')
    ogData.description = ogDesc || twitterDesc || metaDesc || undefined

    // Image
    const ogImage = getMetaContent(html, 'property', 'og:image')
    const twitterImage = getMetaContent(html, 'name', 'twitter:image')
    let imageUrl = ogImage || twitterImage

    // Handle relative image URLs
    if (imageUrl && !imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, url).href
      } catch {
        imageUrl = undefined
      }
    }
    ogData.image = imageUrl

    // Site name
    const ogSite = getMetaContent(html, 'property', 'og:site_name')
    ogData.siteName = ogSite || parsedUrl.hostname

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
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
}
