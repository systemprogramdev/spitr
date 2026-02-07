'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'

const supabase = createClient()

const NOTIF_LABELS: Record<string, string> = {
  follow: 'started following you',
  like: 'liked your spit',
  respit: 'respit your post',
  reply: 'replied to your spit',
  mention: 'mentioned you',
  message: 'sent you a message',
  attack: 'attacked you',
}

function updateBadge(count: number) {
  // Try the Badge API directly (works in some browsers)
  if ('setAppBadge' in navigator) {
    if (count > 0) {
      (navigator as any).setAppBadge(count)
    } else {
      (navigator as any).clearAppBadge()
    }
  }
  // Also tell the service worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SET_BADGE', count })
  }
}

function showBrowserNotification(type: string, actorHandle?: string) {
  if (Notification.permission !== 'granted') return
  if (document.hasFocus()) return // Don't notify if app is focused

  const body = actorHandle
    ? `@${actorHandle} ${NOTIF_LABELS[type] || 'interacted with you'}`
    : NOTIF_LABELS[type] || 'You have a new notification'

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: 'SPITr',
      body,
      tag: `spitr-${type}-${Date.now()}`,
      url: '/notifications',
    })
  }
}

let notifAudio: HTMLAudioElement | null = null
function playNotificationSound() {
  const soundEnabled = useUIStore.getState().soundEnabled
  if (!soundEnabled || typeof window === 'undefined') return
  try {
    if (!notifAudio) {
      notifAudio = new Audio('/sounds/notification.mp3')
      notifAudio.volume = 0.5
    }
    notifAudio.currentTime = 0
    notifAudio.play().catch(() => {})
  } catch {}
}

export function useUnreadNotifications() {
  const { user } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)

  const setBadgedCount = useCallback((count: number) => {
    setUnreadCount(count)
    updateBadge(count)
  }, [])

  useEffect(() => {
    if (!user) {
      setBadgedCount(0)
      return
    }

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)

      setBadgedCount(count || 0)
    }

    fetchUnreadCount()

    // Subscribe to new notifications
    const channel = supabase
      .channel('unread-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          playNotificationSound()
          setUnreadCount(c => {
            const newCount = c + 1
            updateBadge(newCount)
            return newCount
          })

          // Fire a browser notification
          const row = payload.new
          if (row?.actor_id) {
            const { data: actor } = await supabase
              .from('users')
              .select('handle')
              .eq('id', row.actor_id)
              .single()
            showBrowserNotification(row.type, actor?.handle)
          } else {
            showBrowserNotification(row?.type)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch count when notifications are marked as read
          fetchUnreadCount()
        }
      )
      .subscribe()

    // Listen for when user views notifications page
    const handleNotificationsRead = () => {
      setBadgedCount(0)
    }
    window.addEventListener('notifications-read', handleNotificationsRead)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('notifications-read', handleNotificationsRead)
    }
  }, [user, setBadgedCount])

  return unreadCount
}
