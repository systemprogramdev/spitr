import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'
import { getMaxHp } from '@/lib/items'

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  try {
    const { data: spits, error: feedErr } = await supabaseAdmin
      .from('spits')
      .select('id, user_id, content, reply_to_id, created_at, users!spits_user_id_fkey(handle, name, hp, is_destroyed)')
      .order('created_at', { ascending: false })
      .limit(20)

    if (feedErr) {
      return NextResponse.json({ error: feedErr.message }, { status: 500 })
    }

    // Enrich with level data
    const userIds = [...new Set((spits || []).map((s: { user_id: string }) => s.user_id))]
    const { data: xpData } = userIds.length > 0
      ? await supabaseAdmin.from('user_xp').select('user_id, level').in('user_id', userIds)
      : { data: [] }

    const levelMap = new Map((xpData || []).map((x: { user_id: string; level: number }) => [x.user_id, x.level]))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedSpits = (spits || []).map((s: any) => {
      const level = levelMap.get(s.user_id) || 1
      const user = Array.isArray(s.users) ? s.users[0] : s.users
      return {
        ...s,
        hp: user?.hp ?? 5000,
        max_hp: getMaxHp(level),
        level,
        destroyed: user?.is_destroyed ?? false,
      }
    })

    return NextResponse.json({ spits: enrichedSpits })
  } catch (err) {
    console.error('Bot feed error:', err)
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
