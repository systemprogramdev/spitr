import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'
import { getMaxHp } from '@/lib/items'
import { xpForLevel } from '@/lib/xp'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const [userRes, creditsRes, goldRes, xpRes, inventoryRes, depositsRes, buffsRes] = await Promise.all([
      supabaseAdmin.from('users').select('hp, is_destroyed, last_chest_claimed_at').eq('id', botUserId).single(),
      supabaseAdmin.from('user_credits').select('balance').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_gold').select('balance').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_xp').select('xp, level').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_inventory').select('item_type, quantity').eq('user_id', botUserId),
      supabaseAdmin.from('bank_deposits').select('currency, principal, locked_rate, deposited_at, withdrawn').eq('user_id', botUserId),
      supabaseAdmin.from('user_buffs').select('buff_type, charges_remaining').eq('user_id', botUserId),
    ])

    const level = xpRes.data?.level ?? 1
    const xp = xpRes.data?.xp ?? 0
    const maxHp = getMaxHp(level)

    // Daily chest availability
    const lastClaimed = userRes.data?.last_chest_claimed_at
      ? new Date(userRes.data.last_chest_claimed_at).getTime()
      : 0
    const dailyChestAvailable = Date.now() - lastClaimed >= TWENTY_FOUR_HOURS_MS

    // Defense buffs
    const buffs = buffsRes.data ?? []
    const firewall = buffs.find((b: { buff_type: string }) => b.buff_type === 'firewall')
    const kevlar = buffs.find((b: { buff_type: string }) => b.buff_type === 'kevlar')

    return NextResponse.json({
      hp: userRes.data?.hp ?? maxHp,
      max_hp: maxHp,
      destroyed: userRes.data?.is_destroyed ?? false,
      credits: creditsRes.data?.balance ?? 0,
      gold: goldRes.data?.balance ?? 0,
      xp,
      level,
      xp_next_level: xpForLevel(level + 1),
      daily_chest_available: dailyChestAvailable,
      has_firewall: !!firewall,
      kevlar_charges: kevlar?.charges_remaining ?? 0,
      inventory: inventoryRes.data ?? [],
      bank_deposits: depositsRes.data ?? [],
    })
  } catch (err) {
    console.error('Bot status error:', err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
