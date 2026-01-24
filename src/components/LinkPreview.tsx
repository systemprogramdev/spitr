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

export function LinkPreview({ url }: LinkPreviewProps) {
  const [data, setData] = useState<OGData | null>(previewCache.get(url) || null)
  const [loading, setLoading] = useState(!previewCache.has(url))
  const [error, setError] = useState(false)

  useEffect(() => {
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
  }, [url])

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
