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

    const { data, error } = await supabaseAdmin.rpc('credit_card_request_increase', {
      p_user_id: user.id,
    })

    if (error) {
      console.error('CC request increase RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error, daysRemaining: data.days_remaining }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      oldLimit: data.old_limit,
      newLimit: data.new_limit,
      tierCap: data.tier_cap,
    })
  } catch (error) {
    console.error('CC request increase error:', error)
    return NextResponse.json({ error: 'Increase request failed' }, { status: 500 })
  }
}
