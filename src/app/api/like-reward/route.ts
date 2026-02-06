import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { spitId } = await request.json()
    if (!spitId) {
      return NextResponse.json({ error: 'Missing spitId' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('handle_like_reward', {
      p_liker_id: user.id,
      p_spit_id: spitId,
    })

    if (error) {
      console.error('Like reward RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as { success: boolean; rewarded?: boolean; new_hp?: number; author_id?: string; error?: string }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Notify author about like reward (if rewarded and not self)
    if (result.rewarded && result.author_id && result.author_id !== user.id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: result.author_id,
        type: 'like_reward',
        actor_id: user.id,
        spit_id: spitId,
      })
    }

    return NextResponse.json({
      success: true,
      rewarded: result.rewarded,
      newHp: result.new_hp,
    })
  } catch (error) {
    console.error('Like reward error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
