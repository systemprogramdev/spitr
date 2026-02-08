import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'
import { getMaxHp } from '@/lib/items'

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  try {
    const handle = request.nextUrl.searchParams.get('handle')

    if (!handle || typeof handle !== 'string') {
      return NextResponse.json({ error: 'Missing handle parameter' }, { status: 400 })
    }

    // Look up user by handle
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, handle, name, hp, is_destroyed, avatar_url')
      .eq('handle', handle)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get XP/level
    const { data: xp } = await supabaseAdmin
      .from('user_xp')
      .select('level')
      .eq('user_id', user.id)
      .single()

    const level = xp?.level ?? 1
    const maxHp = getMaxHp(level)

    // Check if user is a bot
    const { data: botRecord } = await supabaseAdmin
      .from('bots')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      id: user.id,
      handle: user.handle,
      name: user.name,
      hp: user.hp,
      max_hp: maxHp,
      level,
      destroyed: user.is_destroyed ?? false,
      is_bot: !!botRecord,
    })
  } catch (err) {
    console.error('Bot user lookup error:', err)
    return NextResponse.json({ error: 'User lookup failed' }, { status: 500 })
  }
}
