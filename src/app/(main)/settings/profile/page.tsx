'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

export default function EditProfilePage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const [name, setName] = useState(user?.name || '')
  const [handle, setHandle] = useState(user?.handle || '')
  const [handleError, setHandleError] = useState('')
  const [bio, setBio] = useState(user?.bio || '')
  const [location, setLocation] = useState(user?.location || '')
  const [website, setWebsite] = useState(user?.website || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [bannerUrl, setBannerUrl] = useState(user?.banner_url || '')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [fieldsInitialized, setFieldsInitialized] = useState(!!user)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Sync fields when user loads async (useState initial value only runs once)
  useEffect(() => {
    if (user && !fieldsInitialized) {
      setName(user.name || '')
      setHandle(user.handle || '')
      setBio(user.bio || '')
      setLocation(user.location || '')
      setWebsite(user.website || '')
      setAvatarUrl(user.avatar_url || '')
      setBannerUrl(user.banner_url || '')
      setFieldsInitialized(true)
    }
  }, [user, fieldsInitialized])

  const validateHandle = (value: string) => {
    if (value.length < 3) return 'Handle must be at least 3 characters'
    if (value.length > 15) return 'Handle must be 15 characters or less'
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores allowed'
    return ''
  }

  const checkHandleAvailable = async (value: string) => {
    if (!value || validateHandle(value) || !user) return
    if (value.toLowerCase() === user.handle.toLowerCase()) {
      setHandleError('')
      return
    }

    const { data } = await supabase
      .from('users')
      .select('id')
      .ilike('handle', value)
      .neq('id', user.id)
      .single()

    if (data) {
      setHandleError('Handle is already taken')
    } else {
      setHandleError('')
    }
  }

  const uploadImage = async (file: File, bucket: 'avatars' | 'banners') => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${user?.id}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
    return data.publicUrl
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      return
    }

    setError('')
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Banner must be less than 4MB')
      return
    }

    setError('')
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || isSaving) return

    const validationError = validateHandle(handle)
    if (validationError) {
      setHandleError(validationError)
      return
    }

    setIsSaving(true)
    setError('')

    // Upload files sequentially before saving profile
    let finalAvatarUrl = avatarUrl
    let finalBannerUrl = bannerUrl

    try {
      if (avatarFile) {
        finalAvatarUrl = await uploadImage(avatarFile, 'avatars')
      }
      if (bannerFile) {
        finalBannerUrl = await uploadImage(bannerFile, 'banners')
      }
    } catch (err) {
      console.error('Upload failed:', err)
      setError('Failed to upload image. Please try again.')
      setIsSaving(false)
      return
    }

    const { data, error: updateError } = await supabase
      .from('users')
      .update({
        name: name.trim(),
        handle: handle.toLowerCase(),
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        avatar_url: finalAvatarUrl || null,
        banner_url: finalBannerUrl || null,
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === '23505') {
        setHandleError('Handle is already taken')
      } else {
        setError('Failed to update profile')
      }
      setIsSaving(false)
      return
    }

    if (data) {
      setUser(data)
    }

    setIsSaving(false)
    router.push('/settings')
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div>
      <header className="feed-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => router.back()}
          className="btn btn-sm"
          style={{ background: 'none', border: 'none', padding: '0.5rem' }}
        >
          <span className="sys-icon sys-icon-arrow-left"></span>
        </button>
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          Edit Profile
        </h1>
      </header>

      <form onSubmit={handleSubmit}>
        {/* Banner Upload */}
        <div
          className="image-upload banner-upload"
          style={{
            backgroundImage: (bannerPreview || bannerUrl) ? `url(${bannerPreview || bannerUrl})` : undefined,
          }}
          onClick={() => bannerInputRef.current?.click()}
        >
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerChange}
            style={{ display: 'none' }}
          />
          {!bannerUrl && !bannerPreview && (
            <div className="banner-upload-placeholder">
              <span className="sys-icon sys-icon-image sys-icon-lg"></span>
              <span>Click to upload banner</span>
            </div>
          )}
          <div className="image-upload-overlay">
            <div className="image-upload-icon">
              <span className="sys-icon sys-icon-camera"></span>
            </div>
          </div>
        </div>

        {/* Avatar Upload */}
        <div style={{ padding: '0 1.5rem' }}>
          <div
            className="image-upload avatar-upload"
            style={{
              backgroundImage: (avatarPreview || avatarUrl) ? `url(${avatarPreview || avatarUrl})` : undefined,
            }}
            onClick={() => avatarInputRef.current?.click()}
          >
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
            {!avatarUrl && !avatarPreview && (
              <span className="avatar-upload-letter">{name[0]?.toUpperCase() || '?'}</span>
            )}
            <div className="image-upload-overlay">
              <div className="image-upload-icon">
                <span className="sys-icon sys-icon-camera"></span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div className="panel-bash">
            <div className="panel-bash-header">
              <div className="panel-bash-dots">
                <span className="panel-bash-dot"></span>
                <span className="panel-bash-dot"></span>
                <span className="panel-bash-dot"></span>
              </div>
              <span className="panel-bash-title">edit_profile</span>
            </div>
            <div className="panel-bash-body" style={{ padding: '1rem' }}>
              {error && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  required
                  style={{ width: '100%' }}
                />
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--sys-text-muted)' }}>
                  {name.length}/50
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Handle
                </label>
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
                    style={{ paddingLeft: '1.75rem', width: '100%' }}
                    value={handle}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '')
                      setHandle(val)
                      setHandleError(validateHandle(val))
                    }}
                    onBlur={() => checkHandleAvailable(handle)}
                    maxLength={15}
                    required
                  />
                </div>
                {handleError && (
                  <p style={{ color: 'var(--sys-danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    {handleError}
                  </p>
                )}
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--sys-text-muted)' }}>
                  3-15 characters. Letters, numbers, underscores only.
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Bio
                </label>
              <textarea
                className="input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={3}
                style={{ width: '100%', resize: 'none', fontFamily: 'var(--sys-font-mono)' }}
                placeholder="Tell us about yourself..."
              />
              <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--sys-text-muted)' }}>
                {bio.length}/160
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Location
              </label>
              <input
                type="text"
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={30}
                style={{ width: '100%' }}
                placeholder="Your location"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Website
              </label>
              <input
                type="url"
                className="input"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={{ width: '100%' }}
                placeholder="https://your-website.com"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-glow"
                  disabled={isSaving || !name.trim() || !handle.trim() || !!handleError}
                >
                  {isSaving ? (
                    <>
                      <div className="loading-spinner" style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="sys-icon sys-icon-check" style={{ marginRight: '0.5rem' }}></span>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
