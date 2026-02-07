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

    const { currency, amount } = await request.json()

    if (!currency || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    if (currency !== 'spit' && currency !== 'gold') {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('bank_withdraw', {
      p_user_id: user.id,
      p_currency: currency,
      p_amount: Math.floor(amount),
    })

    if (error) {
      console.error('Bank withdraw RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      withdrawn: data.withdrawn,
      newWalletBalance: data.new_wallet_balance,
    })
  } catch (error) {
    console.error('Bank withdraw error:', error)
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 })
  }
}
