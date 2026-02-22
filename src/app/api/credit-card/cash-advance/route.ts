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

    const { amount } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('credit_card_cash_advance', {
      p_user_id: user.id,
      p_amount: Math.floor(amount),
    })

    if (error) {
      console.error('CC cash advance RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      goldReceived: data.gold_received,
      newCCBalance: data.new_cc_balance,
      newGoldBalance: data.new_gold_balance,
      newCreditScore: data.new_credit_score,
    })
  } catch (error) {
    console.error('CC cash advance error:', error)
    return NextResponse.json({ error: 'Cash advance failed' }, { status: 500 })
  }
}
