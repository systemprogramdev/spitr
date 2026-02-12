import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { XP_AMOUNTS } from '@/lib/xp'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Server-side auth
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action, referenceId } = body

  let amount = XP_AMOUNTS[action]
  if (!amount) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Check for XP boost buff
  const { data: xpBuff } = await adminClient
    .from('user_buffs')
    .select('id, activated_at')
    .eq('user_id', user.id)
    .eq('buff_type', 'xp_boost')
    .single()

  if (xpBuff) {
    const activatedAt = new Date(xpBuff.activated_at)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    if (activatedAt > oneHourAgo) {
      // Buff is active - double XP
      amount *= 2
    } else {
      // Buff expired - clean it up
      await adminClient.from('user_buffs').delete().eq('id', xpBuff.id)
    }
  }

  const { data, error } = await adminClient.rpc('award_xp', {
    p_user_id: user.id,
    p_amount: amount,
    p_action: action,
    p_reference_id: referenceId || null,
  })

  if (error) {
    console.error('XP award error:', error)
    return NextResponse.json({ error: 'Failed to award XP' }, { status: 500 })
  }

  // Insert a notification when the user levels up
  if (data.leveled_up) {
    await adminClient.from('notifications').insert({
      user_id: user.id,
      actor_id: user.id,
      type: 'level_up',
      reference_id: String(data.level),
    })
  }

  return NextResponse.json({
    success: true,
    xp: data.xp,
    level: data.level,
    leveled_up: data.leveled_up,
  })
}
