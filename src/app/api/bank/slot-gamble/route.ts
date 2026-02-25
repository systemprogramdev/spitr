import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { resolveGamble } from '@/lib/slots'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { amount } = await request.json()

    if (!amount || amount <= 0 || amount > 1000000) {
      return NextResponse.json({ error: 'Invalid gamble amount' }, { status: 400 })
    }

    const { data: creditData, error: readError } = await supabaseAdmin
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (readError || !creditData) {
      return NextResponse.json({ error: 'Failed to read balance' }, { status: 500 })
    }

    if (creditData.balance < amount) {
      return NextResponse.json({ error: 'Insufficient balance to gamble' }, { status: 400 })
    }

    const won = resolveGamble()
    const change = won ? amount : -amount
    const newBalance = creditData.balance + change

    const { error: updateError } = await supabaseAdmin
      .from('user_credits')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Balance update failed' }, { status: 500 })
    }

    return NextResponse.json({ won, amount: Math.abs(change), newBalance })
  } catch (error) {
    console.error('Gamble error:', error)
    return NextResponse.json({ error: 'Gamble failed' }, { status: 500 })
  }
}
