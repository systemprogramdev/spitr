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

    const { shares } = await request.json()

    if (!shares || shares <= 0) {
      return NextResponse.json({ error: 'Invalid shares amount' }, { status: 400 })
    }

    const pricePerShare = getStockPrice()

    const { data, error } = await supabaseAdmin.rpc('bank_sell_stock', {
      p_user_id: user.id,
      p_shares: shares,
      p_price_per_share: pricePerShare,
    })

    if (error) {
      console.error('Sell stock RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      sharesSold: data.shares_sold,
      proceeds: data.proceeds,
      remainingShares: data.remaining_shares,
      pricePerShare,
    })
  } catch (error) {
    console.error('Sell stock error:', error)
    return NextResponse.json({ error: 'Stock sale failed' }, { status: 500 })
  }
}
