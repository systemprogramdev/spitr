import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { calculateInterest } from '@/lib/bank'

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

    const { data: deposits, error } = await supabaseAdmin
      .from('bank_deposits')
      .select('id, principal, locked_rate, deposited_at, withdrawn')
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const dustIds = (deposits || [])
      .filter(d => {
        const interest = calculateInterest(
          Number(d.principal),
          Number(d.locked_rate),
          d.deposited_at
        )
        const remaining = Number(d.principal) + interest - Number(d.withdrawn)
        return remaining > 0 && remaining < 1
      })
      .map(d => d.id)

    if (dustIds.length === 0) {
      return NextResponse.json({ success: true, purged: 0 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('bank_deposits')
      .delete()
      .in('id', dustIds)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, purged: dustIds.length })
  } catch (err) {
    console.error('Purge dust error:', err)
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
  }
}
