import { NextRequest, NextResponse } from 'next/server'
import { validateDatacenterKey, supabaseAdmin } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { valid, error, status } = await validateDatacenterKey(request)
  if (!valid) return NextResponse.json({ error }, { status })

  try {
    const { user_id, avatar_url, banner_url } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Verify user exists and is a sybil account
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('id', user_id)
      .eq('account_type', 'sybil')
      .single()

    if (userErr || !user) {
      return NextResponse.json({ error: 'Sybil account not found' }, { status: 404 })
    }

    // Build update object with only provided fields
    const updates: Record<string, string> = {}
    if (avatar_url !== undefined) updates.avatar_url = avatar_url
    if (banner_url !== undefined) updates.banner_url = banner_url

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update (provide avatar_url or banner_url)' }, { status: 400 })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', user_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Also update sybil_bots table so the datacenter UI stays in sync
    await supabaseAdmin
      .from('sybil_bots')
      .update(updates)
      .eq('user_id', user_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Sybil update-profile error:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
