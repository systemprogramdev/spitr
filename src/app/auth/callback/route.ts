import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Check if user has a profile
      const { data: profile } = await supabase
        .from('users')
        .select('handle, avatar_url')
        .eq('id', data.user.id)
        .single()

      // If no profile exists, create one with temporary handle
      if (!profile) {
        const tempHandle = `user_${data.user.id.substring(0, 8)}`
        await supabase.from('users').insert({
          id: data.user.id,
          handle: tempHandle,
          name: tempHandle,
        })

        // Create credits for new user
        await supabase.from('user_credits').insert({
          user_id: data.user.id,
          balance: 1000,
        })

        // Redirect to setup page for new OAuth users
        return NextResponse.redirect(`${origin}/setup`)
      }

      // If handle starts with 'user_', they need to complete setup
      if (profile.handle.startsWith('user_')) {
        // Update avatar from OAuth if not set
        const oauthAvatar = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture
        if (oauthAvatar && !profile.avatar_url) {
          await supabase
            .from('users')
            .update({ avatar_url: oauthAvatar })
            .eq('id', data.user.id)
        }
        return NextResponse.redirect(`${origin}/setup`)
      }

      // Existing user with proper handle, update avatar if needed
      const oauthAvatar = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture
      if (oauthAvatar && !profile.avatar_url) {
        await supabase
          .from('users')
          .update({ avatar_url: oauthAvatar })
          .eq('id', data.user.id)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
