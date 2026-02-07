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

    const { cdId } = await request.json()

    if (!cdId) {
      return NextResponse.json({ error: 'Missing CD ID' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('bank_redeem_cd', {
      p_user_id: user.id,
      p_cd_id: cdId,
    })

    if (error) {
      console.error('Bank redeem CD RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      principal: data.principal,
      bonus: data.bonus,
      payout: data.payout,
      newWalletBalance: data.new_wallet_balance,
    })
  } catch (error) {
    console.error('Bank redeem CD error:', error)
    return NextResponse.json({ error: 'CD redemption failed' }, { status: 500 })
  }
}
