'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_AVATARS = [
  '/avatars/default-1.svg',
  '/avatars/default-2.svg',
  '/avatars/default-3.svg',
  '/avatars/default-4.svg',
]

export default function SetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [error, setError] = useState('')
  const [handleError, setHandleError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        .select('handle, name, avatar_url')
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
      // Pre-fill avatar from OAuth if available
      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url)
      } else if (user.user_metadata?.avatar_url || user.user_metadata?.picture) {
        setAvatarUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture)
      }
      setIsChecking(false)
    }

    checkUser()
  }, [router, supabase])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      return
    }

    setIsUploadingAvatar(true)
    setError('')

    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      setError('Failed to upload avatar')
      setIsUploadingAvatar(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
    setAvatarUrl(data.publicUrl)
    setIsUploadingAvatar(false)
  }

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
        bio: bio.trim() || null,
        avatar_url: avatarUrl || null,
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
            {/* Avatar Selection */}
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>Profile Picture</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '12px',
                  margin: '0 auto',
                  cursor: 'pointer',
                  border: '2px dashed var(--sys-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transition: 'border-color 0.2s',
                }}
              >
                {!avatarUrl && !isUploadingAvatar && (
                  <span className="sys-icon sys-icon-camera" style={{ fontSize: '1.5rem', color: 'var(--sys-text-muted)' }}></span>
                )}
                {isUploadingAvatar && <div className="loading-spinner"></div>}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
              <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Click to upload (optional)
              </p>
            </div>

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

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>Bio (optional)</label>
              <textarea
                className="input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                maxLength={160}
                rows={3}
                style={{ width: '100%', resize: 'none', fontFamily: 'var(--sys-font-mono)' }}
              />
              <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {bio.length}/160
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
              disabled={isLoading || !!handleError || !handle || !name.trim() || isUploadingAvatar}
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
