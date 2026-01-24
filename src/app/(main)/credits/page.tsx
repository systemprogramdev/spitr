'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCredits, CREDIT_COSTS } from '@/hooks/useCredits'
import { useAuth } from '@/hooks/useAuth'
import { StripeCheckoutModal } from '@/components/StripeCheckoutModal'

const CREDIT_PACKAGES = [
  { id: 'starter', credits: 100, price: 199, name: 'Starter Pack', description: 'Perfect for trying things out' },
  { id: 'popular', credits: 500, price: 799, name: 'Popular Pack', description: 'Best value for active users', popular: true },
  { id: 'mega', credits: 1500, price: 1999, name: 'Mega Pack', description: 'For power users' },
  { id: 'whale', credits: 5000, price: 4999, name: 'Whale Pack', description: 'Ultimate spitting power', whale: true },
]

function CreditsPageContent() {
  const searchParams = useSearchParams()
  const { balance, refreshBalance } = useCredits()
  const { user } = useAuth()
  const [selectedPackage, setSelectedPackage] = useState<typeof CREDIT_PACKAGES[0] | null>(null)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const credits = searchParams.get('credits')

    if (success === 'true' && credits) {
      setSuccessMessage(`Successfully purchased ${parseInt(credits).toLocaleString()} spits!`)
      refreshBalance()
      window.history.replaceState({}, '', '/credits')
    } else if (canceled === 'true') {
      setErrorMessage('Purchase canceled. No charges were made.')
      window.history.replaceState({}, '', '/credits')
    }
  }, [searchParams, refreshBalance])

  const handlePurchase = (pkg: typeof CREDIT_PACKAGES[0]) => {
    if (!user) {
      setErrorMessage('Please sign in to purchase credits')
      return
    }
    setSelectedPackage(pkg)
    setIsCheckoutOpen(true)
    setErrorMessage(null)
  }

  const handleSuccess = (credits: number) => {
    setIsCheckoutOpen(false)
    setSelectedPackage(null)
    setSuccessMessage(`Successfully purchased ${credits.toLocaleString()} spits!`)
    refreshBalance()
  }

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span className="sys-icon sys-icon-star" style={{ marginRight: '0.5rem' }}></span>
          Credits
        </h1>
      </header>

      <div style={{ padding: '1.5rem' }}>
        {/* Success/Error Messages */}
        {successMessage && (
          <div
            className="panel glow"
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'rgba(0, 255, 136, 0.1)',
              border: '1px solid var(--sys-success)',
              textAlign: 'center',
            }}
          >
            <span style={{ color: 'var(--sys-success)', fontWeight: 'bold' }}>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            className="panel"
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid var(--sys-error)',
              textAlign: 'center',
            }}
          >
            <span style={{ color: 'var(--sys-error)' }}>{errorMessage}</span>
          </div>
        )}

        {/* Balance Panel */}
        <div className="panel-bash" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">balance</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '2rem', textAlign: 'center' }}>
            <div className="text-glow" style={{ fontSize: '4rem', fontWeight: 'bold' }}>
              {balance.toLocaleString()}
            </div>
            <div style={{ fontSize: '1.25rem', color: 'var(--sys-text-muted)' }}>
              spits available
            </div>
          </div>
        </div>

        {/* Purchase Options */}
        <div className="panel-bash" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">get_more_spits</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {CREDIT_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`panel ${pkg.popular ? 'glow' : ''}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1.25rem',
                    border: pkg.popular ? '2px solid var(--sys-primary)' : pkg.whale ? '2px solid var(--sys-warning)' : undefined,
                    background: pkg.whale ? 'linear-gradient(135deg, rgba(255, 204, 0, 0.05), rgba(255, 136, 0, 0.05))' : undefined,
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onClick={() => handlePurchase(pkg)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = pkg.whale
                      ? '0 4px 20px rgba(255, 204, 0, 0.3)'
                      : '0 4px 20px rgba(0, 255, 136, 0.2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Whale shimmer effect */}
                  {pkg.whale && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '200%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(255, 204, 0, 0.1), transparent)',
                        animation: 'shimmer 3s infinite',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--sys-text)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {pkg.credits.toLocaleString()} Spits
                      {pkg.popular && (
                        <span className="badge badge-glow">Popular</span>
                      )}
                      {pkg.whale && (
                        <span className="badge" style={{ background: 'var(--sys-warning)', color: '#000' }}>Best Deal</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--sys-text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>{pkg.description}</div>
                  </div>

                  <button
                    className={`btn ${pkg.whale ? 'btn-warning' : 'btn-primary'} btn-glow`}
                    style={{
                      minWidth: '80px',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {formatPrice(pkg.price)}
                  </button>
                </div>
              ))}
            </div>

            <p style={{ marginTop: '1rem', fontSize: '0.875rem', textAlign: 'center', color: 'var(--sys-text-muted)' }}>
              Spits never expire. Secure checkout powered by Stripe.
            </p>
          </div>
        </div>

        {/* Costs Table */}
        <div className="panel-bash">
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">spit_costs</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '1.5rem' }}>
            <table style={{ width: '100%', fontFamily: 'var(--sys-font-mono)' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: 'var(--sys-text)' }}>Post a spit</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--sys-primary)' }}>{CREDIT_COSTS.post} spit</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: 'var(--sys-text)' }}>Reply to a spit</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--sys-primary)' }}>{CREDIT_COSTS.reply} spit</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: 'var(--sys-text)' }}>Respit</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--sys-primary)' }}>{CREDIT_COSTS.respit} spit</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: 'var(--sys-text)' }}>
                    Add effect to spit
                    <span style={{ color: 'var(--sys-text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                      (glitch, pulse, flicker, etc.)
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--sys-secondary)' }}>+1 spit</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: 'var(--sys-text)' }}>
                    Add image to spit
                  </td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--sys-warning)' }}>+50 spits</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: 'var(--sys-text)' }}>Like</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--sys-success)' }}>FREE</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: 'var(--sys-text)' }}>Follow</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--sys-success)' }}>FREE</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: 'var(--sys-text)' }}>Direct Message</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--sys-success)' }}>FREE</td>
                </tr>
                <tr style={{ borderTop: '1px solid var(--sys-border)' }}>
                  <td style={{ padding: '0.75rem 0', color: 'var(--sys-text)' }}>
                    Promote spit (24h)
                  </td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--sys-warning)' }}>{CREDIT_COSTS.pin_purchase} spits</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link href="/credits/history" style={{ color: 'var(--sys-text-muted)' }}>
            <span className="sys-icon sys-icon-list" style={{ marginRight: '0.5rem' }}></span>
            View transaction history
          </Link>
        </div>
      </div>

      {/* Stripe Checkout Modal */}
      <StripeCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false)
          setSelectedPackage(null)
        }}
        package={selectedPackage}
        userId={user?.id || ''}
        onSuccess={handleSuccess}
      />

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

export default function CreditsPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <span className="text-glow">Loading...</span>
      </div>
    }>
      <CreditsPageContent />
    </Suspense>
  )
}
