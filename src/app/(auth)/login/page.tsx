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

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
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

        <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--sys-text-muted)' }}>
          or continue with
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={handleGoogleLogin}
          style={{ width: '100%', marginBottom: '1.5rem' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '0.5rem' }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
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
