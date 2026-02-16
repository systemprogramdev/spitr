import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateDatacenterKey } from '@/lib/bot-auth'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const auth = await validateDatacenterKey(request)
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { owner_user_id, name, handle, avatar_url, banner_url } = await request.json()

    if (!owner_user_id || !name || !handle) {
      return NextResponse.json({ error: 'Missing required fields: owner_user_id, name, handle' }, { status: 400 })
    }

    // Validate handle
    const handleRegex = /^[a-z0-9_]{3,20}$/
    if (!handleRegex.test(handle)) {
      return NextResponse.json({ error: 'Handle must be 3-20 chars, lowercase alphanumeric + underscores' }, { status: 400 })
    }

    // Check handle uniqueness
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('handle', handle)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'Handle already taken' }, { status: 409 })
    }

    // Verify owner has a sybil server
    const { data: server } = await supabaseAdmin
      .from('sybil_servers')
      .select('id')
      .eq('owner_user_id', owner_user_id)
      .single()

    if (!server) {
      return NextResponse.json({ error: 'Owner does not have a sybil server' }, { status: 400 })
    }

    // Create auth user for the sybil
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: `sybil_${handle}@spitr.bot`,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { name, handle },
    })

    if (authErr || !authData.user) {
      return NextResponse.json({ error: 'Failed to create sybil auth user' }, { status: 500 })
    }

    const sybilUserId = authData.user.id

    try {
      // Create/update user profile with sybil properties
      // Use upsert because Supabase auth triggers may auto-create the users row
      const { error: userErr } = await supabaseAdmin.from('users').upsert({
        id: sybilUserId,
        handle,
        name,
        bio: null,
        hp: 100,
        avatar_url: avatar_url || null,
        banner_url: banner_url || null,
        account_type: 'sybil',
        sybil_owner_id: owner_user_id,
        revivable: false,
      }, { onConflict: 'id' })

      if (userErr) {
        console.error('Sybil user upsert error:', userErr)
        throw new Error(`User upsert failed: ${userErr.message}`)
      }

      // Verify the critical fields were set (belt and suspenders)
      const { data: verify } = await supabaseAdmin
        .from('users')
        .select('account_type, sybil_owner_id')
        .eq('id', sybilUserId)
        .single()

      if (!verify?.account_type || verify.account_type !== 'sybil') {
        // Force update if upsert didn't set the fields (e.g. trigger race condition)
        await supabaseAdmin.from('users').update({
          account_type: 'sybil',
          sybil_owner_id: owner_user_id,
          revivable: false,
          hp: 100,
        }).eq('id', sybilUserId)
      }

      // Create user_credits (no starting credits)
      await supabaseAdmin.from('user_credits').insert({
        user_id: sybilUserId,
        balance: 0,
      })

      // Create user_gold (no gold)
      await supabaseAdmin.from('user_gold').insert({
        user_id: sybilUserId,
        balance: 0,
      })

      // Create user_xp
      await supabaseAdmin.from('user_xp').insert({
        user_id: sybilUserId,
        xp: 0,
        level: 1,
      })

      // Create sybil_bots record
      await supabaseAdmin.from('sybil_bots').insert({
        server_id: server.id,
        user_id: sybilUserId,
        name,
        handle,
        avatar_url: avatar_url || null,
        banner_url: banner_url || null,
        hp: 100,
        is_alive: true,
        is_deployed: true,
        deployed_at: new Date().toISOString(),
      })

      // Auto-follow the owner (ignore if already following)
      try {
        await supabaseAdmin.from('follows').insert({
          follower_id: sybilUserId,
          following_id: owner_user_id,
        })
      } catch {}


      return NextResponse.json({ user_id: sybilUserId }, { status: 201 })
    } catch (err) {
      // Cleanup on failure
      console.error('Sybil setup error:', err)
      try { await supabaseAdmin.auth.admin.deleteUser(sybilUserId) } catch {}
      try { await supabaseAdmin.from('users').delete().eq('id', sybilUserId) } catch {}
      return NextResponse.json({ error: 'Failed to set up sybil account' }, { status: 500 })
    }
  } catch (error) {
    console.error('Sybil create error:', error)
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}
