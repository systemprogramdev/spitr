import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  try {
    const { data: spits, error: feedErr } = await supabaseAdmin
      .from('spits')
      .select('id, user_id, content, reply_to_id, created_at, users!spits_user_id_fkey(handle, name)')
      .order('created_at', { ascending: false })
      .limit(20)

    if (feedErr) {
      return NextResponse.json({ error: feedErr.message }, { status: 500 })
    }

    return NextResponse.json({ spits })
  } catch (err) {
    console.error('Bot feed error:', err)
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
