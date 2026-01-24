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

interface CreditPackage {
  id: string
  credits: number
  price: number
  name: string
  description: string
  popular?: boolean
  whale?: boolean
}

interface StripeCheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  package: CreditPackage | null
  userId: string
  onSuccess: (credits: number) => void
}

const cardStyle = {
  style: {
    base: {
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '16px',
      '::placeholder': {
        color: '#666',
      },
    },
    invalid: {
      color: '#ff4444',
    },
  },
}

function CheckoutForm({
  pkg,
  onClose,
  onSuccess
}: {
  pkg: CreditPackage
  onClose: () => void
  onSuccess: (credits: number) => void
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
      (elements as any)._commonOptions.clientSecret,
      {
        payment_method: {
          card: cardNumber,
        },
      }
    )

    if (confirmError) {
      setError(confirmError.message || 'Payment failed')
      setIsProcessing(false)
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        await fetch('/api/stripe/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        })
      } catch (err) {
        console.error('Error confirming payment:', err)
      }
      onSuccess(pkg.credits)
    }
  }

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

  return (
    <form onSubmit={handleSubmit}>
      <div className="checkout-header-info">
        <div className="checkout-pkg-name">{pkg.name}</div>
        <div className="checkout-pkg-credits">{pkg.credits.toLocaleString()} spits</div>
        <div className="checkout-pkg-price">{formatPrice(pkg.price)}</div>
      </div>

      <div className="checkout-fields">
        <div className="checkout-field">
          <label>Card Number</label>
          <div className="checkout-input">
            <CardNumberElement
              options={cardStyle}
              onChange={(e) => setCardComplete(prev => ({ ...prev, cardNumber: e.complete }))}
            />
          </div>
        </div>

        <div className="checkout-row">
          <div className="checkout-field">
            <label>Expiry</label>
            <div className="checkout-input">
              <CardExpiryElement
                options={cardStyle}
                onChange={(e) => setCardComplete(prev => ({ ...prev, cardExpiry: e.complete }))}
              />
            </div>
          </div>
          <div className="checkout-field">
            <label>CVC</label>
            <div className="checkout-input">
              <CardCvcElement
                options={cardStyle}
                onChange={(e) => setCardComplete(prev => ({ ...prev, cardCvc: e.complete }))}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="checkout-error">{error}</div>
      )}

      <div className="checkout-buttons">
        <button
          type="button"
          onClick={onClose}
          className="checkout-btn checkout-btn-cancel"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="checkout-btn checkout-btn-pay"
          disabled={!stripe || !elements || isProcessing || !isComplete}
        >
          {isProcessing ? (
            <>
              <span className="checkout-spinner"></span>
              Processing...
            </>
          ) : (
            <>Pay {formatPrice(pkg.price)}</>
          )}
        </button>
      </div>

      <div className="checkout-footer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        Secure payment
      </div>

      <style jsx>{`
        form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .checkout-header-info {
          text-align: center;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--sys-border);
        }
        .checkout-pkg-name {
          font-size: 0.85rem;
          color: var(--sys-text-muted);
          margin-bottom: 0.25rem;
        }
        .checkout-pkg-credits {
          font-size: 1.5rem;
          font-weight: bold;
          color: var(--sys-primary);
          text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        }
        .checkout-pkg-price {
          font-size: 1.1rem;
          color: var(--sys-text);
          margin-top: 0.25rem;
        }
        .checkout-fields {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .checkout-field {
          flex: 1;
        }
        .checkout-field label {
          display: block;
          font-size: 0.8rem;
          color: var(--sys-text-muted);
          margin-bottom: 0.5rem;
        }
        .checkout-input {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--sys-border);
          border-radius: 6px;
          padding: 0.75rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .checkout-input:focus-within {
          border-color: var(--sys-primary);
          box-shadow: 0 0 10px rgba(0, 255, 136, 0.2);
        }
        .checkout-row {
          display: flex;
          gap: 1rem;
        }
        .checkout-error {
          background: rgba(255, 68, 68, 0.1);
          border: 1px solid var(--sys-error);
          border-radius: 6px;
          padding: 0.75rem;
          color: var(--sys-error);
          font-size: 0.85rem;
          text-align: center;
        }
        .checkout-buttons {
          display: flex;
          gap: 0.75rem;
        }
        .checkout-btn {
          flex: 1;
          padding: 0.875rem 1rem;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }
        .checkout-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .checkout-btn-cancel {
          background: transparent;
          border: 1px solid var(--sys-border);
          color: var(--sys-text-muted);
        }
        .checkout-btn-cancel:hover:not(:disabled) {
          border-color: var(--sys-text-muted);
          color: var(--sys-text);
        }
        .checkout-btn-pay {
          flex: 2;
          background: var(--sys-primary);
          border: none;
          color: #000;
        }
        .checkout-btn-pay:hover:not(:disabled) {
          box-shadow: 0 0 25px rgba(0, 255, 136, 0.5);
        }
        .checkout-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0,0,0,0.3);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .checkout-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          color: var(--sys-text-muted);
          font-size: 0.75rem;
        }
      `}</style>
    </form>
  )
}

export function StripeCheckoutModal({
  isOpen,
  onClose,
  package: pkg,
  userId,
  onSuccess,
}: StripeCheckoutModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && pkg && userId) {
      setLoading(true)
      setError(null)
      setClientSecret(null)

      fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id, userId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error)
          } else {
            setClientSecret(data.clientSecret)
          }
        })
        .catch(() => {
          setError('Failed to initialize payment')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isOpen, pkg, userId])

  // Hide Stripe badge
  useEffect(() => {
    if (isOpen) {
      const style = document.createElement('style')
      style.id = 'hide-stripe-badge'
      style.textContent = `
        iframe[name*="__privateStripeController"],
        iframe[src*="js.stripe.com/v3/controller"],
        div[class*="StripeElement"] + div[style*="position: fixed"] {
          display: none !important;
        }
      `
      document.head.appendChild(style)
      return () => {
        const el = document.getElementById('hide-stripe-badge')
        if (el) el.remove()
      }
    }
  }, [isOpen])

  if (!isOpen || !pkg) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-dots">
            <span className="dot dot-red"></span>
            <span className="dot dot-yellow"></span>
            <span className="dot dot-green"></span>
          </div>
          <div className="modal-title">checkout</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="modal-loading">
              <div className="loading-spinner"></div>
              <div>Loading...</div>
            </div>
          )}

          {error && !loading && (
            <div className="modal-error">
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
                    colorPrimary: '#00ff88',
                    colorBackground: '#0a0a0f',
                    colorText: '#e0e0e0',
                    colorDanger: '#ff4444',
                  },
                },
              }}
            >
              <CheckoutForm pkg={pkg} onClose={onClose} onSuccess={onSuccess} />
            </Elements>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .modal-container {
          background: #0d0d12;
          border: 1px solid var(--sys-primary);
          border-radius: 12px;
          width: 100%;
          max-width: 380px;
          box-shadow: 0 0 40px rgba(0, 255, 136, 0.15);
          animation: modalIn 0.2s ease-out;
        }
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .modal-header {
          background: rgba(0, 255, 136, 0.03);
          border-bottom: 1px solid var(--sys-border);
          padding: 0.65rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .modal-dots {
          display: flex;
          gap: 5px;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .dot-red { background: #ff5f56; }
        .dot-yellow { background: #ffbd2e; }
        .dot-green { background: #27ca40; }
        .modal-title {
          flex: 1;
          font-family: var(--sys-font-mono);
          font-size: 0.85rem;
          color: var(--sys-primary);
        }
        .modal-close {
          background: transparent;
          border: none;
          color: var(--sys-text-muted);
          cursor: pointer;
          padding: 2px;
          display: flex;
          transition: color 0.2s;
        }
        .modal-close:hover {
          color: var(--sys-error);
        }
        .modal-body {
          padding: 1.25rem;
        }
        .modal-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          gap: 1rem;
          color: var(--sys-text-muted);
          font-size: 0.9rem;
        }
        .loading-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid var(--sys-border);
          border-top-color: var(--sys-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .modal-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1.5rem;
          gap: 1rem;
          text-align: center;
          color: var(--sys-error);
        }
      `}</style>
    </div>
  )
}
