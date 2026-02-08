import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    // Fetch recent notifications with actor info
    const { data: notifications, error: notifErr } = await supabaseAdmin
      .from('notifications')
      .select(`
        id,
        type,
        actor_id,
        spit_id,
        reference_id,
        read,
        created_at,
        actor:users!notifications_actor_id_fkey(handle, name)
      `)
      .eq('user_id', botUserId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (notifErr) {
      console.error('Bot notifications query error:', notifErr)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    const result = (notifications ?? []).map((n: Record<string, unknown>) => {
      const actor = n.actor as { handle: string; name: string } | null
      return {
        id: n.id,
        type: n.type,
        actor_id: n.actor_id,
        actor_handle: actor?.handle ?? null,
        actor_name: actor?.name ?? null,
        spit_id: n.spit_id,
        reference_id: n.reference_id,
        read: n.read,
        created_at: n.created_at,
      }
    })

    return NextResponse.json({ notifications: result })
  } catch (err) {
    console.error('Bot notifications error:', err)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}
