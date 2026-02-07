import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const [userRes, creditsRes, goldRes, xpRes, inventoryRes, depositsRes] = await Promise.all([
      supabaseAdmin.from('users').select('hp, is_destroyed').eq('id', botUserId).single(),
      supabaseAdmin.from('user_credits').select('balance').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_gold').select('balance').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_xp').select('xp, level').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_inventory').select('item_type, quantity').eq('user_id', botUserId),
      supabaseAdmin.from('bank_deposits').select('currency, principal, locked_rate, deposited_at, withdrawn').eq('user_id', botUserId),
    ])

    return NextResponse.json({
      hp: userRes.data?.hp ?? 5000,
      is_destroyed: userRes.data?.is_destroyed ?? false,
      credits: creditsRes.data?.balance ?? 0,
      gold: goldRes.data?.balance ?? 0,
      xp: xpRes.data?.xp ?? 0,
      level: xpRes.data?.level ?? 1,
      inventory: inventoryRes.data ?? [],
      bank_deposits: depositsRes.data ?? [],
    })
  } catch (err) {
    console.error('Bot status error:', err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
