'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
    setIsStandalone(standalone)

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(iOS)

    // Check if dismissed recently
    const dismissed = localStorage.getItem('spitr-install-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      // Don't show for 7 days after dismissal
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return
      }
    }

    // Listen for beforeinstallprompt (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show prompt after a delay
      setTimeout(() => setShowPrompt(true), 2000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // For iOS, show custom prompt after delay if not standalone
    if (iOS && !standalone) {
      setTimeout(() => setShowPrompt(true), 3000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('spitr-install-dismissed', Date.now().toString())
  }

  // Don't show if already installed or not on mobile
  if (isStandalone || !showPrompt) return null

  return (
    <div className="install-prompt-overlay">
      <div className="install-prompt">
        <div className="install-prompt-header">
          <div className="install-prompt-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#0a0a0f"/>
              <text x="16" y="22" fontFamily="Arial Black" fontSize="16" fontWeight="900" fill="#00ff88" textAnchor="middle">S</text>
            </svg>
          </div>
          <div className="install-prompt-title">
            <span className="text-glow">Install SPITr</span>
          </div>
          <button className="install-prompt-close" onClick={handleDismiss}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="install-prompt-body">
          {isIOS ? (
            <>
              <p>Install SPITr on your home screen for the best experience.</p>
              <div className="install-prompt-ios-steps">
                <div className="install-step">
                  <span className="install-step-num">1</span>
                  <span>Tap the <strong>Share</strong> button</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                </div>
                <div className="install-step">
                  <span className="install-step-num">2</span>
                  <span>Select <strong>Add to Home Screen</strong></span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </div>
              </div>
            </>
          ) : (
            <>
              <p>Add SPITr to your home screen for quick access and a better experience.</p>
              <button className="btn btn-primary btn-glow" onClick={handleInstall} style={{ width: '100%' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Install App
              </button>
            </>
          )}
        </div>

        <button className="install-prompt-later" onClick={handleDismiss}>
          Maybe later
        </button>
      </div>

      <style jsx>{`
        .install-prompt-overlay {
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
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .install-prompt {
          background: var(--sys-bg);
          border: 1px solid var(--sys-primary);
          border-radius: 16px 16px 0 0;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 -10px 40px rgba(0, 255, 136, 0.2);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .install-prompt-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-bottom: 1px solid var(--sys-border);
        }

        .install-prompt-icon {
          flex-shrink: 0;
        }

        .install-prompt-icon svg {
          filter: drop-shadow(0 0 10px rgba(0, 255, 136, 0.5));
        }

        .install-prompt-title {
          flex: 1;
          font-size: 1.1rem;
          font-weight: bold;
          font-family: var(--sys-font-display);
        }

        .install-prompt-close {
          background: none;
          border: none;
          color: var(--sys-text-muted);
          cursor: pointer;
          padding: 0.25rem;
          transition: color 0.2s;
        }

        .install-prompt-close:hover {
          color: var(--sys-error);
        }

        .install-prompt-body {
          padding: 1.25rem;
        }

        .install-prompt-body p {
          margin: 0 0 1rem;
          color: var(--sys-text-muted);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .install-prompt-ios-steps {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .install-step {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: var(--sys-surface);
          border-radius: 8px;
          color: var(--sys-text);
          font-size: 0.9rem;
        }

        .install-step svg {
          color: var(--sys-primary);
          flex-shrink: 0;
        }

        .install-step-num {
          width: 24px;
          height: 24px;
          background: var(--sys-primary);
          color: var(--sys-bg);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.8rem;
          flex-shrink: 0;
        }

        .install-step span {
          flex: 1;
        }

        .install-step strong {
          color: var(--sys-primary);
        }

        .install-prompt-later {
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

        .install-prompt-later:hover {
          color: var(--sys-text);
          background: var(--sys-surface);
        }
      `}</style>
    </div>
  )
}
