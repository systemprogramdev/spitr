import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { ITEM_MAP } from '@/lib/items'

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

    const { bot_user_id, item_type } = await request.json()

    if (!bot_user_id || !item_type) {
      return NextResponse.json({ error: 'Missing bot_user_id or item_type' }, { status: 400 })
    }

    const item = ITEM_MAP.get(item_type)
    if (!item || item.category !== 'potion') {
      return NextResponse.json({ error: 'Invalid potion type' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('revive_bot', {
      p_owner_id: user.id,
      p_bot_user_id: bot_user_id,
      p_item_type: item_type,
      p_heal_amount: item.healAmount || 0,
    })

    if (error) {
      console.error('Revive bot RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as { success: boolean; error?: string; new_hp?: number; max_hp?: number; potion_used?: string }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      new_hp: result.new_hp,
      max_hp: result.max_hp,
      potion_used: result.potion_used,
    })
  } catch (err) {
    console.error('Revive bot error:', err)
    return NextResponse.json({ error: 'Failed to revive bot' }, { status: 500 })
  }
}
