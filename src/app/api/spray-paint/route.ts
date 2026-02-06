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

    const { targetUserId } = await request.json()
    const sprayerId = user.id

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Must specify a target user' },
        { status: 400 }
      )
    }

    if (targetUserId === sprayerId) {
      return NextResponse.json(
        { error: 'You can\'t spray yourself' },
        { status: 400 }
      )
    }

    // Check inventory
    const { data: inv } = await supabaseAdmin
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', sprayerId)
      .eq('item_type', 'spray_paint')
      .single()

    if (!inv || inv.quantity < 1) {
      return NextResponse.json(
        { error: 'You don\'t have any spray paint' },
        { status: 400 }
      )
    }

    // Deduct from inventory
    if (inv.quantity === 1) {
      await supabaseAdmin
        .from('user_inventory')
        .delete()
        .eq('user_id', sprayerId)
        .eq('item_type', 'spray_paint')
    } else {
      await supabaseAdmin
        .from('user_inventory')
        .update({ quantity: inv.quantity - 1 })
        .eq('user_id', sprayerId)
        .eq('item_type', 'spray_paint')
    }

    // Create spray paint with 24h expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabaseAdmin.from('spray_paints').insert({
      sprayer_id: sprayerId,
      target_user_id: targetUserId,
      expires_at: expiresAt,
    })

    // Notify target
    await supabaseAdmin.from('notifications').insert({
      user_id: targetUserId,
      type: 'spray',
      actor_id: sprayerId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Spray paint error:', error)
    return NextResponse.json(
      { error: 'Failed to spray paint' },
      { status: 500 }
    )
  }
}
