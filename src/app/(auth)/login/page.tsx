'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="panel-bash glow" style={{ maxWidth: '420px', margin: '0 auto' }}>
      <div className="panel-bash-header">
        <div className="panel-bash-dots">
          <span className="panel-bash-dot"></span>
          <span className="panel-bash-dot"></span>
          <span className="panel-bash-dot"></span>
        </div>
        <span className="panel-bash-title">spitr://login</span>
      </div>
      <div className="panel-bash-body" style={{ padding: '1.5rem' }}>
        <h1 className="text-glow" style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>
          Welcome back
        </h1>
        <p style={{ color: 'var(--sys-text-muted)', marginBottom: '1.5rem' }}>
          Sign in to your SPITr account
        </p>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-glow"
            disabled={isLoading}
            style={{ width: '100%', marginBottom: '1rem' }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '1rem' }}>
          <Link href="/reset-password" style={{ color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>
            Forgot password?
          </Link>
        </div>

        <div style={{ borderTop: '1px solid var(--sys-border)', paddingTop: '1rem', textAlign: 'center' }}>
          <span style={{ color: 'var(--sys-text-muted)' }}>Don&apos;t have an account? </span>
          <Link href="/signup" className="text-glow">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}
