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

    const userId = user.id

    // Check inventory
    const { data: inv } = await supabaseAdmin
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', userId)
      .eq('item_type', 'smoke_bomb')
      .single()

    if (!inv || inv.quantity < 1) {
      return NextResponse.json({ error: "You don't have a smoke bomb" }, { status: 400 })
    }

    // Deduct from inventory
    if (inv.quantity === 1) {
      await supabaseAdmin.from('user_inventory').delete().eq('user_id', userId).eq('item_type', 'smoke_bomb')
    } else {
      await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', userId).eq('item_type', 'smoke_bomb')
    }

    // Delete all spray paints on this user
    const { count } = await supabaseAdmin
      .from('spray_paints')
      .delete({ count: 'exact' })
      .eq('target_user_id', userId)

    return NextResponse.json({
      success: true,
      cleared: count || 0,
    })
  } catch (error) {
    console.error('Use smoke bomb error:', error)
    return NextResponse.json({ error: 'Failed to use smoke bomb' }, { status: 500 })
  }
}
