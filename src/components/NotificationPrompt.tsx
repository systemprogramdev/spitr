'use client'

import { useState, useEffect } from 'react'

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Don't show if notifications aren't supported
    if (!('Notification' in window)) return

    // Don't show if already granted or denied
    if (Notification.permission !== 'default') return

    // Check if dismissed recently
    const dismissed = localStorage.getItem('spitr-notif-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      // Don't show for 14 days after dismissal
      if (Date.now() - dismissedTime < 14 * 24 * 60 * 60 * 1000) return
    }

    // Show prompt after a short delay (let the app load first)
    const timer = setTimeout(() => setShowPrompt(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  const handleEnable = async () => {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      localStorage.setItem('spitr-notif-enabled', 'true')
    }
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('spitr-notif-dismissed', Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="notif-prompt-overlay">
      <div className="notif-prompt">
        <div className="notif-prompt-header">
          <div className="notif-prompt-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--sys-primary)" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div className="notif-prompt-title">
            <span className="text-glow">Enable Notifications</span>
          </div>
          <button className="notif-prompt-close" onClick={handleDismiss}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="notif-prompt-body">
          <p>Get notified when someone likes, replies, or mentions you — even when SPITr is in the background.</p>
          <button className="btn btn-primary btn-glow" onClick={handleEnable} style={{ width: '100%' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Turn On Notifications
          </button>
        </div>

        <button className="notif-prompt-later" onClick={handleDismiss}>
          Maybe later
        </button>
      </div>

      <style jsx>{`
        .notif-prompt-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 10000;
          padding: 1rem;
          padding-bottom: calc(1rem + env(safe-area-inset-bottom));
          animation: notifFadeIn 0.3s ease-out;
        }

        @keyframes notifFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .notif-prompt {
          background: var(--sys-bg);
          border: 1px solid var(--sys-primary);
          border-radius: 16px 16px 0 0;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 -10px 40px rgba(0, 255, 136, 0.2);
          animation: notifSlideUp 0.3s ease-out;
        }

        @keyframes notifSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .notif-prompt-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-bottom: 1px solid var(--sys-border);
        }

        .notif-prompt-icon {
          flex-shrink: 0;
          filter: drop-shadow(0 0 10px rgba(0, 255, 136, 0.5));
        }

        .notif-prompt-title {
          flex: 1;
          font-size: 1.1rem;
          font-weight: bold;
          font-family: var(--sys-font-display);
        }

        .notif-prompt-close {
          background: none;
          border: none;
          color: var(--sys-text-muted);
          cursor: pointer;
          padding: 0.25rem;
          transition: color 0.2s;
        }

        .notif-prompt-close:hover {
          color: var(--sys-error);
        }

        .notif-prompt-body {
          padding: 1.25rem;
        }

        .notif-prompt-body p {
          margin: 0 0 1rem;
          color: var(--sys-text-muted);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .notif-prompt-later {
          display: block;
          width: 100%;
          padding: 1rem;
          background: none;
          border: none;
          border-top: 1px solid var(--sys-border);
          color: var(--sys-text-muted);
          font-size: 0.9rem;
          cursor: pointer;
          transition: color 0.2s, background 0.2s;
        }

        .notif-prompt-later:hover {
          color: var(--sys-text);
          background: var(--sys-surface);
        }
      `}</style>
    </div>
  )
}
