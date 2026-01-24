'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

const supabase = createClient()

export function useUnreadMessages() {
  const { user } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }

    const fetchUnreadCount = async () => {
      // Get all conversations the user is part of
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)

      if (!participations || participations.length === 0) {
        setUnreadCount(0)
        return
      }

      let count = 0

      for (const participation of participations) {
        // Get the latest message in this conversation from other users
        const { data: messages } = await supabase
          .from('messages')
          .select('created_at, sender_id')
          .eq('conversation_id', participation.conversation_id)
          .neq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)

        const latestMessage = messages?.[0]
        if (latestMessage) {
          const messageTime = new Date(latestMessage.created_at)
          const lastReadTime = new Date(participation.last_read_at || 0)
          if (messageTime > lastReadTime) {
            count++
          }
        }
      }

      setUnreadCount(count)
    }

    fetchUnreadCount()

    // Subscribe to new messages
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as { sender_id: string }
          // If it's not from us, increment count
          if (newMsg.sender_id !== user.id) {
            setUnreadCount(c => c + 1)
          }
        }
      )
      .subscribe()

    // Listen for when user reads messages
    const handleMessagesRead = () => {
      fetchUnreadCount()
    }
    window.addEventListener('messages-read', handleMessagesRead)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('messages-read', handleMessagesRead)
    }
  }, [user])

  return unreadCount
}
