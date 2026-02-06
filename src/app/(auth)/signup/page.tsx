'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
      setError('Handle can only contain letters, numbers, and underscores')
      setIsLoading(false)
      return
    }

    if (handle.length < 3 || handle.length > 15) {
      setError('Handle must be 3-15 characters')
      setIsLoading(false)
      return
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('handle')
      .ilike('handle', handle)
      .single()

    if (existingUser) {
      setError('Handle is already taken')
      setIsLoading(false)
      return
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          handle,
          name,
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setIsLoading(false)
      return
    }

    if (data.user) {
      // Ensure public profile exists (trigger may have already created it)
      const userId = data.user.id
      await supabase
        .from('users')
        .upsert({
          id: userId,
          handle: handle.toLowerCase(),
          name: name.trim(),
        }, { onConflict: 'id' })

      // Ensure credits and gold rows exist
      await Promise.all([
        supabase.from('user_credits').upsert({ user_id: userId }, { onConflict: 'user_id' }),
        supabase.from('user_gold').upsert({ user_id: userId }, { onConflict: 'user_id' }),
      ])

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
        <span className="panel-bash-title">spitr://signup</span>
      </div>
      <div className="panel-bash-body" style={{ padding: '1.5rem' }}>
        <h1 className="text-glow" style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>
          Join SPITr
        </h1>
        <p style={{ color: 'var(--sys-text-muted)', marginBottom: '1.5rem' }}>
          Create your account and get <span className="badge badge-success">1,000 free spits</span>
        </p>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>Display Name</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              maxLength={50}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>Handle</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--sys-primary)',
                fontFamily: 'var(--sys-font-mono)',
              }}>@</span>
              <input
                type="text"
                className="input"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                placeholder="username"
                required
                maxLength={15}
                style={{ paddingLeft: '1.75rem' }}
              />
            </div>
            <small style={{ color: 'var(--sys-text-muted)', fontSize: '0.75rem' }}>
              3-15 characters, letters, numbers, underscores
            </small>
          </div>

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
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-glow"
            disabled={isLoading}
            style={{ width: '100%', marginBottom: '1rem' }}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--sys-border)', paddingTop: '1rem', marginTop: '1rem', textAlign: 'center' }}>
          <span style={{ color: 'var(--sys-text-muted)' }}>Already have an account? </span>
          <Link href="/login" className="text-glow">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
