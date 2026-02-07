import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getStockPrice } from '@/lib/bank'

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

    const { spitAmount } = await request.json()

    if (!spitAmount || spitAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const pricePerShare = getStockPrice()

    const { data, error } = await supabaseAdmin.rpc('bank_buy_stock', {
      p_user_id: user.id,
      p_spit_amount: spitAmount,
      p_price_per_share: pricePerShare,
    })

    if (error) {
      console.error('Buy stock RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      sharesBought: data.shares_bought,
      totalShares: data.total_shares,
      spent: data.spent,
      pricePerShare,
    })
  } catch (error) {
    console.error('Buy stock error:', error)
    return NextResponse.json({ error: 'Stock purchase failed' }, { status: 500 })
  }
}
