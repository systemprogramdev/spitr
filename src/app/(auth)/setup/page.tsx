'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState('')
  const [handleError, setHandleError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Check if user already has a proper profile
      const { data: profile } = await supabase
        .from('users')
        .select('handle, name')
        .eq('id', user.id)
        .single()

      // If handle doesn't start with 'user_', they've already set up
      if (profile && !profile.handle.startsWith('user_')) {
        router.push('/')
        return
      }

      setUserId(user.id)
      // Pre-fill name from OAuth if available
      if (user.user_metadata?.full_name) {
        setName(user.user_metadata.full_name)
      }
      setIsChecking(false)
    }

    checkUser()
  }, [router, supabase])

  const validateHandle = (value: string) => {
    if (value.length < 3) {
      return 'Handle must be at least 3 characters'
    }
    if (value.length > 15) {
      return 'Handle must be 15 characters or less'
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Only letters, numbers, and underscores allowed'
    }
    return ''
  }

  const checkHandleAvailable = async (value: string) => {
    if (!value || validateHandle(value) || !userId) return

    const { data } = await supabase
      .from('users')
      .select('id')
      .ilike('handle', value)
      .neq('id', userId!)
      .single()

    if (data) {
      setHandleError('Handle is already taken')
    } else {
      setHandleError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    const validationError = validateHandle(handle)
    if (validationError) {
      setHandleError(validationError)
      return
    }

    if (!name.trim()) {
      setError('Please enter your name')
      return
    }

    setIsLoading(true)
    setError('')

    // Update the user profile
    const { error: updateError } = await supabase
      .from('users')
      .update({
        handle: handle.toLowerCase(),
        name: name.trim(),
      })
      .eq('id', userId)

    if (updateError) {
      if (updateError.code === '23505') {
        setHandleError('Handle is already taken')
      } else {
        setError(updateError.message)
      }
      setIsLoading(false)
      return
    }

    router.push('/')
  }

  if (isChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="panel-bash glow" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="panel-bash-body" style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="panel-bash glow" style={{ maxWidth: '450px', width: '100%' }}>
        <div className="panel-bash-header">
          <div className="panel-bash-dots">
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
          </div>
          <span className="panel-bash-title">setup_profile</span>
        </div>
        <div className="panel-bash-body" style={{ padding: '2rem' }}>
          <h1 className="text-glow" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Welcome to SPITr
          </h1>
          <p style={{ color: 'var(--sys-text-muted)', marginBottom: '2rem' }}>
            Choose your identity
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>Display Name</label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>Handle</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--sys-text-muted)',
                  fontFamily: 'var(--sys-font-mono)',
                }}>@</span>
                <input
                  type="text"
                  className="input"
                  style={{ paddingLeft: '1.75rem' }}
                  value={handle}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '')
                    setHandle(val)
                    setHandleError(validateHandle(val))
                  }}
                  onBlur={() => checkHandleAvailable(handle)}
                  placeholder="yourhandle"
                  maxLength={15}
                  required
                />
              </div>
              {handleError && (
                <p style={{ color: 'var(--sys-danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  {handleError}
                </p>
              )}
              <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                3-15 characters. Letters, numbers, underscores only.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-glow"
              style={{ width: '100%' }}
              disabled={isLoading || !!handleError || !handle || !name.trim()}
            >
              {isLoading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--sys-text-muted)', fontSize: '0.8rem' }}>
            You&apos;ll receive 1,000 free spits to get started!
          </p>
        </div>
      </div>
    </div>
  )
}
