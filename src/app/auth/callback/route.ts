import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Use admin client for database operations to bypass RLS timing issues
      const adminClient = createAdminClient()

      // Check if user has a profile
      const { data: profile } = await adminClient
        .from('users')
        .select('handle, avatar_url')
        .eq('id', data.user.id)
        .single()

      // If no profile exists, create one with temporary handle
      if (!profile) {
        const tempHandle = `user_${data.user.id.substring(0, 8)}`
        const oauthAvatar = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture

        const { error: insertError } = await adminClient.from('users').insert({
          id: data.user.id,
          handle: tempHandle,
          name: data.user.user_metadata?.full_name || tempHandle,
          avatar_url: oauthAvatar || null,
        })

        if (insertError) {
          console.error('Failed to create user profile:', insertError)
          return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`)
        }

        // Create credits for new user
        const { error: creditsError } = await adminClient.from('user_credits').insert({
          user_id: data.user.id,
          balance: 1000,
        })

        if (creditsError) {
          console.error('Failed to create user credits:', creditsError)
        }

        // Redirect to setup page for new OAuth users
        return NextResponse.redirect(`${origin}/setup`)
      }

      // If handle starts with 'user_', they need to complete setup
      if (profile.handle.startsWith('user_')) {
        // Update avatar from OAuth if not set
        const oauthAvatar = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture
        if (oauthAvatar && !profile.avatar_url) {
          await adminClient
            .from('users')
            .update({ avatar_url: oauthAvatar })
            .eq('id', data.user.id)
        }
        return NextResponse.redirect(`${origin}/setup`)
      }

      // Existing user with proper handle, update avatar if needed
      const oauthAvatar = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture
      if (oauthAvatar && !profile.avatar_url) {
        await adminClient
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
