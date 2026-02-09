'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/uiStore'
import { toast } from '@/stores/toastStore'

const themes = [
  { id: 'neon', name: 'Neon', description: 'Vibrant cyberpunk colors' },
  { id: 'terminal', name: 'Terminal', description: 'Classic green phosphor' },
  { id: 'terminal-amber', name: 'Amber', description: 'Warm amber monochrome' },
  { id: 'hologram', name: 'Hologram', description: 'Futuristic blue glow' },
  { id: 'military', name: 'Military', description: 'Tactical ops style' },
  { id: 'bloodline', name: 'Bloodline', description: 'Crimson red darkness' },
  { id: 'ocean', name: 'Ocean', description: 'Deep sea blues' },
  { id: 'synthwave', name: 'Synthwave', description: 'Purple & pink retro future' },
  { id: 'toxic', name: 'Toxic', description: 'Radioactive lime green' },
  { id: 'frost', name: 'Frost', description: 'Icy cool cyan glow' },
  { id: 'retro', name: 'Retro', description: 'Warm orange nostalgia' },
  { id: 'light', name: 'Light', description: 'Clean light mode' },
  { id: 'light-cyber', name: 'Light Cyber', description: 'Light mode with edge' },
]

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, scanlines, soundEnabled, notificationsEnabled, setTheme, toggleScanlines, toggleSound, setNotificationsEnabled } = useUIStore()
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    if (!('Notification' in window)) {
      setBrowserPermission('unsupported')
    } else {
      setBrowserPermission(Notification.permission)
    }
  }, [])

  const handleNotificationsToggle = async () => {
    if (notificationsEnabled) {
      // Turning off — unsubscribe from push
      try {
        const reg = await navigator.serviceWorker.ready
        const subscription = await reg.pushManager.getSubscription()
        if (subscription) {
          await fetch('/api/push-subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          })
          await subscription.unsubscribe()
        }
      } catch {}
      setNotificationsEnabled(false)
      toast.info('Notifications disabled')
      return
    }

    // Turning on — need browser permission
    if (browserPermission === 'unsupported') {
      toast.info('Notifications are not supported in this browser')
      return
    }

    if (browserPermission === 'denied') {
      toast.info('Notifications were blocked. Enable them in your browser settings.')
      return
    }

    if (browserPermission !== 'granted') {
      const permission = await Notification.requestPermission()
      setBrowserPermission(permission)
      if (permission !== 'granted') {
        toast.info('Notification permission was not granted')
        return
      }
    }

    // Subscribe to Web Push
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (!res.ok) throw new Error('Failed to save subscription')

      setNotificationsEnabled(true)
      toast.info('Notifications enabled')
    } catch (err) {
      console.error('Push subscription error:', err)
      toast.info('Failed to enable notifications. Try again.')
    }
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    document.body.setAttribute('data-theme', newTheme)
  }

  const handleScanlinesToggle = () => {
    toggleScanlines()
    document.body.setAttribute('data-scanlines', (!scanlines).toString())
  }

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span className="sys-icon sys-icon-settings" style={{ marginRight: '0.5rem' }}></span>
          Settings
        </h1>
      </header>

      <div style={{ padding: '1.5rem' }}>
        {/* Profile Settings */}
        <div className="panel-bash" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">profile</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '1rem' }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div
                  className="avatar"
                  style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: 'var(--sys-primary)',
                    backgroundImage: user.avatar_url ? `url(${user.avatar_url})` : undefined,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', color: 'var(--sys-text)' }}>{user.name}</div>
                  <div style={{ color: 'var(--sys-text-muted)' }}>@{user.handle}</div>
                </div>
              </div>
            )}
            <Link href="/settings/profile" className="btn btn-outline" style={{ width: '100%' }}>
              <span className="sys-icon sys-icon-edit" style={{ marginRight: '0.5rem' }}></span>
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Notifications */}
        <div className="panel-bash" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">notifications</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={handleNotificationsToggle}
                />
                <span style={{ color: 'var(--sys-text)' }}>Push notifications</span>
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--sys-text-muted)', marginTop: '0.25rem', marginLeft: '2rem' }}>
                Get notified for likes, replies, mentions, attacks, and more
              </p>
              {browserPermission === 'denied' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--sys-danger)', marginTop: '0.5rem', marginLeft: '2rem' }}>
                  Blocked by browser — enable in your browser/OS settings
                </p>
              )}
            </div>
            <div>
              <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={toggleSound}
                />
                <span style={{ color: 'var(--sys-text)' }}>Notification sound</span>
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--sys-text-muted)', marginTop: '0.25rem', marginLeft: '2rem' }}>
                Play a sound when new notifications arrive
              </p>
            </div>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="panel-bash" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">appearance</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={scanlines}
                  onChange={handleScanlinesToggle}
                />
                <span style={{ color: 'var(--sys-text)' }}>Enable scanlines effect</span>
              </label>
            </div>

            <div>
              <label className="label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                Theme
              </label>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    className={theme === t.id ? 'panel glow' : 'panel'}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      border: theme === t.id ? '1px solid var(--sys-primary)' : '1px solid var(--sys-border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      background: theme === t.id ? 'var(--sys-surface)' : 'transparent',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: theme === t.id ? 'bold' : 'normal', color: 'var(--sys-text)' }}>{t.name}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--sys-text-muted)' }}>{t.description}</div>
                    </div>
                    {theme === t.id && <span className="badge badge-glow">Active</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="panel-bash" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">account</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '1rem' }}>
            <Link
              href="/settings/account"
              className="btn btn-outline"
              style={{ width: '100%', marginBottom: '0.75rem' }}
            >
              <span className="sys-icon sys-icon-user" style={{ marginRight: '0.5rem' }}></span>
              Account Settings
            </Link>
            <button
              onClick={signOut}
              className="btn btn-outline"
              style={{ width: '100%' }}
            >
              <span className="sys-icon sys-icon-lock" style={{ marginRight: '0.5rem' }}></span>
              Sign Out
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="panel-bash" style={{ border: '1px solid var(--sys-danger)' }}>
          <div className="panel-bash-header" style={{ borderColor: 'var(--sys-danger)' }}>
            <div className="panel-bash-dots">
              <span className="panel-bash-dot" style={{ background: 'var(--sys-danger)' }}></span>
              <span className="panel-bash-dot" style={{ background: 'var(--sys-danger)' }}></span>
              <span className="panel-bash-dot" style={{ background: 'var(--sys-danger)' }}></span>
            </div>
            <span className="panel-bash-title" style={{ color: 'var(--sys-danger)' }}>danger_zone</span>
          </div>
          <div className="panel-bash-body" style={{ padding: '1rem' }}>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--sys-text-muted)' }}>
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button
              className="btn btn-danger"
              style={{ width: '100%' }}
              onClick={() => {
                if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                  if (window.confirm('This will permanently delete all your data. Type confirm to proceed.')) {
                    toast.info('Account deletion is not yet available. Please contact support.')
                  }
                }
              }}
            >
              <span className="sys-icon sys-icon-alert-triangle" style={{ marginRight: '0.5rem' }}></span>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
