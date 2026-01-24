'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

export default function AccountSettingsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsChangingPassword(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess('Password updated successfully')
      setNewPassword('')
      setConfirmPassword('')
    }

    setIsChangingPassword(false)
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
          Account Settings
        </h1>
      </header>

      <div style={{ padding: '1.5rem' }}>
        {/* Account Info */}
        <div className="panel-bash" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">account_info</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem' }}>
                Username
              </label>
              <p style={{ color: 'var(--sys-text)', fontFamily: 'var(--sys-font-mono)' }}>@{user.handle}</p>
            </div>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem' }}>
                Account Created
              </label>
              <p style={{ color: 'var(--sys-text)', fontFamily: 'var(--sys-font-mono)' }}>
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="panel-bash">
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">change_password</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '1rem' }}>
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            {success && (
              <div className="alert alert-success" style={{ marginBottom: '1rem', color: 'var(--sys-success)' }}>
                {success}
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  New Password
                </label>
                <input
                  type="password"
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  style={{ width: '100%' }}
                  placeholder="Enter new password"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  style={{ width: '100%' }}
                  placeholder="Confirm new password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-glow"
                disabled={isChangingPassword || !newPassword || !confirmPassword}
                style={{ width: '100%' }}
              >
                {isChangingPassword ? (
                  <>
                    <div className="loading-spinner" style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <span className="sys-icon sys-icon-lock" style={{ marginRight: '0.5rem' }}></span>
                    Update Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
