'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

const supabase = createClient()

export function useUnreadNotifications() {
  const { user } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)

      setUnreadCount(count || 0)
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
        () => {
          setUnreadCount(c => c + 1)
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
      setUnreadCount(0)
    }
    window.addEventListener('notifications-read', handleNotificationsRead)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('notifications-read', handleNotificationsRead)
    }
  }, [user])

  return unreadCount
}
