import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: bots, error } = await supabaseAdmin
      .from('bots')
      .select('*, bot_configs(*), users!bots_user_id_fkey(avatar_url, banner_url, bio, name)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch bots error:', error)
      return NextResponse.json({ error: 'Failed to fetch bots' }, { status: 500 })
    }

    return NextResponse.json({ bots })
  } catch (error) {
    console.error('My bots error:', error)
    return NextResponse.json({ error: 'Failed to fetch bots' }, { status: 500 })
  }
}
