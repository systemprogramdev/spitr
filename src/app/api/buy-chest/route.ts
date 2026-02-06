import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin.rpc('buy_chest', {
      p_user_id: user.id,
    })

    if (error) {
      console.error('Buy chest RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as { success: boolean; error?: string; chest_id?: string; new_balance?: number }

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to buy chest' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      chestId: result.chest_id,
      newBalance: result.new_balance,
    })
  } catch (error) {
    console.error('Buy chest error:', error)
    return NextResponse.json({ error: 'Failed to buy chest' }, { status: 500 })
  }
}
