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

    const { targetUserId, customTitle } = await request.json()
    const userId = user.id

    if (!targetUserId || !customTitle) {
      return NextResponse.json({ error: 'Missing target or title' }, { status: 400 })
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: "You can't tag yourself" }, { status: 400 })
    }

    // Sanitize and limit title
    const sanitized = customTitle.trim().slice(0, 30)
    if (sanitized.length === 0) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }

    // Check inventory
    const { data: inv } = await supabaseAdmin
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', userId)
      .eq('item_type', 'name_tag')
      .single()

    if (!inv || inv.quantity < 1) {
      return NextResponse.json({ error: "You don't have a name tag" }, { status: 400 })
    }

    // Deduct from inventory
    if (inv.quantity === 1) {
      await supabaseAdmin.from('user_inventory').delete().eq('user_id', userId).eq('item_type', 'name_tag')
    } else {
      await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', userId).eq('item_type', 'name_tag')
    }

    // Insert name tag with 24h expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabaseAdmin.from('name_tags').insert({
      tagger_id: userId,
      target_user_id: targetUserId,
      custom_title: sanitized,
      expires_at: expiresAt,
    })

    // Send notification
    await supabaseAdmin.from('notifications').insert({
      user_id: targetUserId,
      type: 'spray' as any,
      actor_id: userId,
      reference_id: sanitized,
    })

    return NextResponse.json({
      success: true,
      title: sanitized,
    })
  } catch (error) {
    console.error('Use name tag error:', error)
    return NextResponse.json({ error: 'Failed to use name tag' }, { status: 500 })
  }
}
