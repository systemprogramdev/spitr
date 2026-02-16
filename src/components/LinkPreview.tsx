'use client'

import { useState, useEffect } from 'react'

interface OGData {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
}

interface LinkPreviewProps {
  url: string
}

// Simple in-memory cache for previews
const previewCache = new Map<string, OGData | null>()

// Cache for resolved TikTok short URLs
const tiktokCache = new Map<string, string>()

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com' || u.hostname === 'm.youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split(/[?&]/)[0] || null
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1]?.split(/[?&]/)[0] || null
    }
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split(/[?&]/)[0] || null
  } catch {
    return null
  }
  return null
}

// Check if URL is a SoundCloud track/playlist
function getSoundCloudUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')
    // Direct links: soundcloud.com/artist/track or m.soundcloud.com/artist/track
    if ((host === 'soundcloud.com' || host === 'm.soundcloud.com')
      && u.pathname.split('/').filter(Boolean).length >= 2) {
      return url
    }
    // Short links from mobile app: on.soundcloud.com/xxxxx
    if (host === 'on.soundcloud.com' && u.pathname.length > 1) {
      return url
    }
  } catch {
    return null
  }
  return null
}

// Extract TikTok video ID from various URL formats
// Returns { videoId, needsResolve } — short URLs need server-side resolution
function getTikTokInfo(url: string): { videoId: string | null; isShortUrl: boolean } {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')

    // Full URL: tiktok.com/@user/video/1234567890
    if ((host === 'tiktok.com' || host === 'm.tiktok.com') && u.pathname.includes('/video/')) {
      const match = u.pathname.match(/\/video\/(\d+)/)
      if (match) return { videoId: match[1], isShortUrl: false }
    }

    // Short URL: vm.tiktok.com/xxxxx — needs server-side redirect resolution
    if (host === 'vm.tiktok.com' && u.pathname.length > 1) {
      return { videoId: null, isShortUrl: true }
    }

    // m.tiktok.com/v/ID format
    if (host === 'm.tiktok.com' && u.pathname.startsWith('/v/')) {
      const match = u.pathname.match(/\/v\/(\d+)/)
      if (match) return { videoId: match[1], isShortUrl: false }
    }
  } catch {
    return { videoId: null, isShortUrl: false }
  }
  return { videoId: null, isShortUrl: false }
}

// Extract Spotify embed info: { type, id }
function getSpotifyEmbed(url: string): { type: string; id: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'open.spotify.com') return null

    // Matches /track/ID, /album/ID, /playlist/ID, /episode/ID
    const match = u.pathname.match(/^\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/)
    if (match) return { type: match[1], id: match[2] }
  } catch {
    return null
  }
  return null
}

// Extract Twitter/X tweet ID
function getTwitterTweetId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')
    if (host !== 'twitter.com' && host !== 'x.com') return null

    // Matches /user/status/1234567890
    const match = u.pathname.match(/\/[^/]+\/status\/(\d+)/)
    if (match) return match[1]
  } catch {
    return null
  }
  return null
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [data, setData] = useState<OGData | null>(previewCache.get(url) || null)
  const [loading, setLoading] = useState(!previewCache.has(url))
  const [error, setError] = useState(false)
  const [resolvedTikTokId, setResolvedTikTokId] = useState<string | null>(tiktokCache.get(url) || null)
  const [tiktokResolving, setTiktokResolving] = useState(false)

  const videoId = getYouTubeVideoId(url)
  const soundcloudUrl = getSoundCloudUrl(url)
  const tiktokInfo = getTikTokInfo(url)
  const spotifyEmbed = getSpotifyEmbed(url)
  const tweetId = getTwitterTweetId(url)

  // The effective TikTok video ID (direct or resolved)
  const tiktokVideoId = tiktokInfo.videoId || resolvedTikTokId

  // Resolve TikTok short URLs
  useEffect(() => {
    if (!tiktokInfo.isShortUrl || tiktokVideoId) return
    if (tiktokCache.has(url)) {
      setResolvedTikTokId(tiktokCache.get(url)!)
      return
    }

    setTiktokResolving(true)
    fetch(`/api/tiktok-resolve?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => {
        if (data.videoId) {
          tiktokCache.set(url, data.videoId)
          setResolvedTikTokId(data.videoId)
        }
      })
      .catch(() => {})
      .finally(() => setTiktokResolving(false))
  }, [url, tiktokInfo.isShortUrl, tiktokVideoId])

  const isEmbed = videoId || soundcloudUrl || tiktokVideoId || tiktokInfo.isShortUrl || spotifyEmbed || tweetId

  useEffect(() => {
    // Skip unfurl for embeddable URLs
    if (isEmbed) {
      setLoading(false)
      return
    }

    if (previewCache.has(url)) {
      setData(previewCache.get(url) || null)
      setLoading(false)
      return
    }

    const fetchPreview = async () => {
      try {
        const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`)
        if (!res.ok) throw new Error('Failed')

        const ogData = await res.json()
        previewCache.set(url, ogData)
        setData(ogData)
      } catch {
        previewCache.set(url, null)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchPreview()
  }, [url, isEmbed])

  // YouTube embed
  if (videoId) {
    return (
      <div className="video-embed" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  // TikTok embed
  if (tiktokVideoId) {
    return (
      <div className="tiktok-embed" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://www.tiktok.com/embed/v2/${tiktokVideoId}`}
          title="TikTok video"
          allow="encrypted-media"
          allowFullScreen
        />
      </div>
    )
  }

  // TikTok short URL resolving
  if (tiktokInfo.isShortUrl && tiktokResolving) {
    return (
      <div className="link-preview link-preview-loading">
        <div className="link-preview-skeleton" />
      </div>
    )
  }

  // Spotify embed
  if (spotifyEmbed) {
    const isCompact = spotifyEmbed.type === 'track' || spotifyEmbed.type === 'episode'
    return (
      <div className={`spotify-embed ${isCompact ? 'spotify-compact' : 'spotify-tall'}`} onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://open.spotify.com/embed/${spotifyEmbed.type}/${spotifyEmbed.id}?theme=0`}
          title="Spotify player"
          allow="encrypted-media"
          allowFullScreen
        />
      </div>
    )
  }

  // SoundCloud embed
  if (soundcloudUrl) {
    const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(soundcloudUrl)}&color=%2300ff88&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`
    return (
      <div className="soundcloud-embed" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={embedUrl}
          title="SoundCloud player"
          allow="autoplay"
          scrolling="no"
        />
      </div>
    )
  }

  // Twitter/X embed
  if (tweetId) {
    return (
      <div className="twitter-embed" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark`}
          title="Tweet"
          allowFullScreen
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="link-preview link-preview-loading">
        <div className="link-preview-skeleton" />
      </div>
    )
  }

  if (error || !data || (!data.title && !data.description && !data.image)) {
    return null
  }

  const hostname = new URL(url).hostname.replace('www.', '')

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="link-preview"
      onClick={(e) => e.stopPropagation()}
    >
      {data.image && (
        <div className="link-preview-image">
          <img src={data.image} alt="" loading="lazy" />
        </div>
      )}
      <div className="link-preview-content">
        <span className="link-preview-site">{data.siteName || hostname}</span>
        {data.title && <span className="link-preview-title">{data.title}</span>}
        {data.description && (
          <span className="link-preview-desc">
            {data.description.length > 100
              ? data.description.slice(0, 100) + '...'
              : data.description}
          </span>
        )}
      </div>
    </a>
  )
}
