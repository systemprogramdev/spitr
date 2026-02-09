'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { NotificationWithActor } from '@/types'
import { formatDistanceToNow } from '@/lib/utils'

export default function NotificationsPage() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:users!notifications_actor_id_fkey(*),
          spit:spits(*, reply_to_id)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotifications(data || [])
      setIsLoading(false)

      // Mark all as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

      // Dispatch event to update unread count in nav
      window.dispatchEvent(new CustomEvent('notifications-read'))
    }

    fetchNotifications()
  }, [user, supabase])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow': return 'user'
      case 'like': return 'heart'
      case 'respit': return 'repeat'
      case 'reply': return 'message'
      case 'mention': return 'at-sign'
      case 'message': return 'mail'
      case 'attack': return 'zap'
      case 'like_reward': return 'star'
      case 'transfer': return 'dollar-sign'
      case 'level_up': return 'trending-up'
      default: return 'bell'
    }
  }

  const getNotificationText = (notification: NotificationWithActor) => {
    switch (notification.type) {
      case 'follow':
        return 'followed you'
      case 'like':
        return 'liked your spit'
      case 'respit':
        return 'respit your spit'
      case 'reply':
        return 'replied to your spit'
      case 'mention':
        return 'mentioned you'
      case 'message':
        return 'sent you a message'
      case 'attack':
        return `attacked ${notification.spit_id ? 'your spit' : 'you'} with ${notification.reference_id || 'a weapon'}`
      case 'like_reward':
        return 'liked your spit (+1 credit, +5 HP)'
      case 'transfer':
        return `sent you ${notification.reference_id || ''} spits`
      case 'level_up':
        return `You reached Level ${notification.reference_id || ''}! +100 Spits, +10 Gold, +1 Chest`
      default:
        return ''
    }
  }

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span className="sys-icon sys-icon-bell" style={{ marginRight: '0.5rem' }}></span>
          Notifications
        </h1>
      </header>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem', color: 'var(--sys-text-muted)' }}>Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="panel-bash" style={{ margin: '1rem' }}>
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">notifications</span>
          </div>
          <div className="panel-bash-body" style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="sys-icon sys-icon-bell sys-icon-lg" style={{ marginBottom: '1rem', display: 'block', opacity: 0.5 }}></span>
            <p style={{ color: 'var(--sys-text-muted)' }}>No notifications yet</p>
          </div>
        </div>
      ) : (
        <div>
          {notifications.map((notification) => {
            // For reply notifications, link to the original spit (not the reply)
            // The original spit belongs to the current user
            const getNotificationHref = () => {
              if (notification.type === 'message' && notification.reference_id) {
                return `/messages/${notification.reference_id}`
              }
              if (notification.type === 'transfer') {
                return `/${notification.actor.handle}`
              }
              if (notification.type === 'level_up') {
                return `/${notification.actor.handle}`
              }
              if (notification.type === 'attack') {
                if (notification.spit_id && notification.spit) {
                  return `/${notification.actor.handle}/status/${notification.spit.id}`
                }
                return `/${notification.actor.handle}`
              }
              if (!notification.spit) return `/${notification.actor.handle}`
              if (notification.type === 'reply' && notification.spit.reply_to_id) {
                return `/${user!.handle}/status/${notification.spit.reply_to_id}`
              }
              return `/${notification.actor.handle}/status/${notification.spit.id}`
            }

            return (
            <Link
              key={notification.id}
              href={getNotificationHref()}
              className="spit"
              style={{
                display: 'flex',
                gap: '0.75rem',
                backgroundColor: notification.read ? 'transparent' : 'var(--sys-surface)',
              }}
            >
              <div
                className="avatar"
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'var(--sys-primary)',
                  backgroundImage: notification.actor.avatar_url
                    ? `url(${notification.actor.avatar_url})`
                    : undefined,
                }}
              />
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--sys-text)' }}>
                  <span className={`sys-icon sys-icon-${getNotificationIcon(notification.type)}`} style={{ marginRight: '0.5rem', color: 'var(--sys-primary)' }}></span>
                  <strong>{notification.actor.name}</strong>{' '}
                  <span style={{ color: 'var(--sys-text-muted)' }}>{getNotificationText(notification)}</span>
                </p>
                {notification.spit && (
                  <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--sys-text-muted)', fontFamily: 'var(--sys-font-mono)' }}>
                    {notification.spit.content.slice(0, 100)}
                    {notification.spit.content.length > 100 && '...'}
                  </p>
                )}
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--sys-text-muted)' }}>
                  {formatDistanceToNow(notification.created_at)}
                </p>
              </div>
            </Link>
          )})}
        </div>
      )}
    </div>
  )
}
