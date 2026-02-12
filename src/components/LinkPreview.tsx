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

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    // youtube.com/watch?v=ID
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com' || u.hostname === 'm.youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      // youtube.com/embed/ID
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split(/[?&]/)[0] || null
      // youtube.com/shorts/ID
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1]?.split(/[?&]/)[0] || null
    }
    // youtu.be/ID
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split(/[?&]/)[0] || null
  } catch {
    return null
  }
  return null
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [data, setData] = useState<OGData | null>(previewCache.get(url) || null)
  const [loading, setLoading] = useState(!previewCache.has(url))
  const [error, setError] = useState(false)

  const videoId = getYouTubeVideoId(url)

  useEffect(() => {
    // Skip unfurl for YouTube — we embed directly
    if (videoId) {
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
  }, [url, videoId])

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
