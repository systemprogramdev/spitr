import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check eligibility
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('last_chest_claimed_at')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    const lastClaimed = userData.last_chest_claimed_at
      ? new Date(userData.last_chest_claimed_at).getTime()
      : 0

    if (Date.now() - lastClaimed < TWENTY_FOUR_HOURS_MS) {
      return NextResponse.json({ error: 'Daily chest already claimed' }, { status: 400 })
    }

    // Atomic: update timestamp first (prevents double claim)
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('users')
      .update({ last_chest_claimed_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id')

    if (claimErr || !claimed || claimed.length === 0) {
      return NextResponse.json({ error: 'Failed to claim' }, { status: 500 })
    }

    // Create chest
    const { data: chest, error: chestErr } = await supabaseAdmin
      .from('user_chests')
      .insert({ user_id: user.id })
      .select('id')
      .single()

    if (chestErr || !chest) {
      console.error('Failed to create chest:', chestErr)
      return NextResponse.json({ error: 'Failed to create chest' }, { status: 500 })
    }

    return NextResponse.json({ success: true, chestId: chest.id })
  } catch (error) {
    console.error('Claim daily chest error:', error)
    return NextResponse.json({ error: 'Failed to claim chest' }, { status: 500 })
  }
}
