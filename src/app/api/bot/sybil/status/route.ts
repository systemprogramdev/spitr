import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get server
    const { data: server } = await supabaseAdmin
      .from('sybil_servers')
      .select('*')
      .eq('owner_user_id', user.id)
      .single()

    if (!server) {
      return NextResponse.json({ server: null })
    }

    // Get sybil bots for this server
    const { data: bots } = await supabaseAdmin
      .from('sybil_bots')
      .select('id, name, handle, avatar_url, hp, is_alive, is_deployed, deployed_at, died_at, created_at')
      .eq('server_id', server.id)
      .order('created_at', { ascending: true })

    const sybilBots = bots || []
    const alive = sybilBots.filter(b => b.is_alive && b.is_deployed).length
    const dead = sybilBots.filter(b => !b.is_alive).length
    const deploying = sybilBots.filter(b => !b.is_deployed && b.is_alive).length

    return NextResponse.json({
      server: {
        id: server.id,
        status: server.status,
        max_sybils: server.max_sybils,
        created_at: server.created_at,
      },
      bots: sybilBots,
      counts: { alive, dead, deploying, total: sybilBots.length },
    })
  } catch (error) {
    console.error('Sybil status error:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
