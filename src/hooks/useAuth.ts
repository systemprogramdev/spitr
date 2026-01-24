'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

const supabase = createClient()

export function useAuth() {
  const router = useRouter()
  const { user, isLoading, setUser } = useAuthStore()

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
          .then(({ data: profile }) => {
            setUser(profile)
          })
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }) => {
              setUser(profile)
            })
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }

  return {
    user,
    isLoading,
    signOut,
  }
}
