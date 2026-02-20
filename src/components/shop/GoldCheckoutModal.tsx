'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface GoldPackage {
  id: string
  gold: number
  price: number
  name: string
  description: string
  popular?: boolean
  whale?: boolean
}

interface GoldCheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  package: GoldPackage | null
  userId: string
  onSuccess: (gold: number) => void
}

const cardStyle = {
  style: {
    base: {
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: '#666' },
    },
    invalid: { color: '#ff4444' },
  },
}

function GoldCheckoutForm({
  pkg,
  onClose,
  onSuccess,
  clientSecret,
}: {
  pkg: GoldPackage
  onClose: () => void
  onSuccess: (gold: number) => void
  clientSecret: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState({
    cardNumber: false,
    cardExpiry: false,
    cardCvc: false,
  })

  const isComplete = cardComplete.cardNumber && cardComplete.cardExpiry && cardComplete.cardCvc

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    const cardNumber = elements.getElement(CardNumberElement)
    if (!cardNumber) return

    setIsProcessing(true)
    setError(null)

    const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      { payment_method: { card: cardNumber } }
    )

    if (confirmError) {
      setError(confirmError.message || 'Payment failed')
      setIsProcessing(false)
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        await fetch('/api/stripe/confirm-gold-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        })
      } catch (err) {
        console.error('Error confirming gold payment:', err)
      }
      onSuccess(pkg.gold)
    }
  }

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--sys-border)' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--sys-text-muted)', marginBottom: '0.25rem' }}>{pkg.name}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFD700', textShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }}>
          {pkg.gold.toLocaleString()} Gold
        </div>
        <div style={{ fontSize: '1.1rem', color: 'var(--sys-text)', marginTop: '0.25rem' }}>{formatPrice(pkg.price)}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--sys-text-muted)', marginBottom: '0.5rem' }}>Card Number</label>
          <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--sys-border)', borderRadius: '6px', padding: '0.75rem' }}>
            <CardNumberElement options={cardStyle} onChange={(e) => setCardComplete(prev => ({ ...prev, cardNumber: e.complete }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--sys-text-muted)', marginBottom: '0.5rem' }}>Expiry</label>
            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--sys-border)', borderRadius: '6px', padding: '0.75rem' }}>
              <CardExpiryElement options={cardStyle} onChange={(e) => setCardComplete(prev => ({ ...prev, cardExpiry: e.complete }))} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--sys-text-muted)', marginBottom: '0.5rem' }}>CVC</label>
            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--sys-border)', borderRadius: '6px', padding: '0.75rem' }}>
              <CardCvcElement options={cardStyle} onChange={(e) => setCardComplete(prev => ({ ...prev, cardCvc: e.complete }))} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid var(--sys-error)', borderRadius: '6px', padding: '0.75rem', color: 'var(--sys-error)', fontSize: '0.85rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }} disabled={isProcessing}>
          Cancel
        </button>
        <button type="submit" className="btn btn-warning" style={{ flex: 2 }} disabled={!stripe || !elements || isProcessing || !isComplete}>
          {isProcessing ? 'Processing...' : `Pay ${formatPrice(pkg.price)}`}
        </button>
      </div>
    </form>
  )
}

export function GoldCheckoutModal({ isOpen, onClose, package: pkg, userId, onSuccess }: GoldCheckoutModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && pkg && userId) {
      setLoading(true)
      setError(null)
      setClientSecret(null)

      fetch('/api/stripe/create-gold-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id, userId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) setError(data.error)
          else setClientSecret(data.clientSecret)
        })
        .catch(() => setError('Failed to initialize payment'))
        .finally(() => setLoading(false))
    }
  }, [isOpen, pkg, userId])

  if (!isOpen || !pkg) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#0d0d12', border: '1px solid #FFD700', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: '0 0 40px rgba(255,215,0,0.15)', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem', color: 'var(--sys-text-muted)' }}>
            <div className="loading-spinner"></div>
            <div>Loading...</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', gap: '1rem', textAlign: 'center', color: 'var(--sys-error)' }}>
            <div>{error}</div>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        )}

        {clientSecret && !loading && !error && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#FFD700',
                  colorBackground: '#0a0a0f',
                  colorText: '#e0e0e0',
                  colorDanger: '#ff4444',
                },
              },
            }}
          >
            <GoldCheckoutForm pkg={pkg} onClose={onClose} onSuccess={onSuccess} clientSecret={clientSecret} />
          </Elements>
        )}
      </div>
    </div>
  )
}
