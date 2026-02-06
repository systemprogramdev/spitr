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

    const { recipientId } = await request.json()
    if (!recipientId) {
      return NextResponse.json({ error: 'Missing recipientId' }, { status: 400 })
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Get sender's total sent in last 24h
    const { data: sentData } = await supabaseAdmin
      .from('credit_transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'transfer_sent')
      .gte('created_at', cutoff)

    const sentToday = sentData?.reduce((sum, t) => sum + Math.abs(t.amount), 0) ?? 0

    // Get recipient's total received in last 24h
    const { data: receivedData } = await supabaseAdmin
      .from('credit_transactions')
      .select('amount')
      .eq('user_id', recipientId)
      .eq('type', 'transfer_received')
      .gte('created_at', cutoff)

    const receivedToday = receivedData?.reduce((sum, t) => sum + t.amount, 0) ?? 0

    return NextResponse.json({
      sentToday,
      receivedToday,
      dailyLimit: 100,
    })
  } catch (error) {
    console.error('Transfer limits error:', error)
    return NextResponse.json({ error: 'Failed to check limits' }, { status: 500 })
  }
}
