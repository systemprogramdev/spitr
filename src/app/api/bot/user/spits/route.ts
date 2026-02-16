import { NextRequest, NextResponse } from 'next/server'
import { validateDatacenterKey, supabaseAdmin } from '@/lib/bot-auth'

export async function GET(request: NextRequest) {
  const auth = await validateDatacenterKey(request)
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id param' }, { status: 400 })
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 5, 50)

  // Verify user exists
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: spits, error } = await supabaseAdmin
    .from('spits')
    .select('id, content, created_at, user_id')
    .eq('user_id', userId)
    .is('reply_to_id', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch spits' }, { status: 500 })
  }

  return NextResponse.json({
    spits: (spits || []).map(s => ({
      id: s.id,
      content: s.content,
      created_at: s.created_at,
      user_id: s.user_id,
    })),
  })
}
