import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { CD_TIERS } from '@/lib/bank'

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

    const { currency, amount, termDays } = await request.json()

    if (!currency || !amount || amount <= 0 || !termDays) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    if (currency !== 'spit' && currency !== 'gold') {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
    }

    const tier = CD_TIERS.find(t => t.termDays === termDays)
    if (!tier) {
      return NextResponse.json({ error: 'Invalid term' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('bank_buy_cd', {
      p_user_id: user.id,
      p_currency: currency,
      p_amount: Math.floor(amount),
      p_term_days: termDays,
      p_rate: tier.rate,
    })

    if (error) {
      console.error('Bank buy CD RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      cdId: data.cd_id,
      maturesAt: data.matures_at,
      newWalletBalance: data.new_wallet_balance,
    })
  } catch (error) {
    console.error('Bank buy CD error:', error)
    return NextResponse.json({ error: 'CD purchase failed' }, { status: 500 })
  }
}
