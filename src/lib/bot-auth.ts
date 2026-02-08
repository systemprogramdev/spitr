import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { XP_AMOUNTS } from '@/lib/xp'
import { getCurrentDailyRate } from '@/lib/bank'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BotContext {
  bot: { id: string; owner_id: string; user_id: string; name: string; handle: string; personality: string; is_active: boolean }
  botUserId: string
}

interface ValidateResult {
  context?: BotContext
  error?: string
  status?: number
}

export async function validateBotRequest(request: NextRequest): Promise<ValidateResult> {
  const datacenterKey = request.headers.get('X-Datacenter-Key')
  const botId = request.headers.get('X-Bot-Id')

  if (!datacenterKey) {
    return { error: 'Missing X-Datacenter-Key header', status: 401 }
  }
  if (!botId) {
    return { error: 'Missing X-Bot-Id header', status: 400 }
  }

  // Hash the key and check against datacenter_keys table
  const keyHash = crypto.createHash('sha256').update(datacenterKey).digest('hex')

  const { data: keyRow, error: keyErr } = await supabaseAdmin
    .from('datacenter_keys')
    .select('id')
    .eq('key_hash', keyHash)
    .single()

  if (keyErr || !keyRow) {
    return { error: 'Invalid datacenter key', status: 401 }
  }

  // Validate bot exists and is active
  const { data: bot, error: botErr } = await supabaseAdmin
    .from('bots')
    .select('id, owner_id, user_id, name, handle, personality, is_active')
    .eq('user_id', botId)
    .single()

  if (botErr || !bot) {
    return { error: 'Bot not found', status: 404 }
  }

  if (!bot.is_active) {
    return { error: 'Bot is deactivated', status: 403 }
  }

  // Check weekly paycheck on every bot action (fire-and-forget)
  checkBotPaycheck(bot.user_id)

  return {
    context: {
      bot,
      botUserId: bot.user_id,
    },
  }
}

const WEEKLY_FREE_CREDITS = 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function checkBotPaycheck(botUserId: string) {
  try {
    const { data: credits } = await supabaseAdmin
      .from('user_credits')
      .select('balance, free_credits_at')
      .eq('user_id', botUserId)
      .single()

    if (!credits) return

    const lastFreeCredits = credits.free_credits_at
      ? new Date(credits.free_credits_at).getTime()
      : 0

    if (Date.now() - lastFreeCredits < SEVEN_DAYS_MS) return

    // Atomic claim
    const tempBalance = credits.balance + WEEKLY_FREE_CREDITS
    const { data: claimed } = await supabaseAdmin
      .from('user_credits')
      .update({
        balance: tempBalance,
        free_credits_at: new Date().toISOString(),
      })
      .eq('user_id', botUserId)
      .is('free_credits_at', credits.free_credits_at)
      .select('user_id')

    if (!claimed || claimed.length === 0) return

    // Deposit to bank
    const lockedRate = getCurrentDailyRate()
    const { data: depositResult, error: depositErr } = await supabaseAdmin.rpc('bank_deposit', {
      p_user_id: botUserId,
      p_currency: 'spit',
      p_amount: WEEKLY_FREE_CREDITS,
      p_locked_rate: lockedRate,
    })

    if (depositErr) {
      // Rollback
      await supabaseAdmin
        .from('user_credits')
        .update({ balance: credits.balance })
        .eq('user_id', botUserId)
      return
    }

    await supabaseAdmin.from('credit_transactions').insert({
      user_id: botUserId,
      type: 'free_weekly',
      amount: WEEKLY_FREE_CREDITS,
      balance_after: depositResult.new_wallet_balance,
    })
  } catch {
    // Non-critical
  }
}

export async function awardBotXP(botUserId: string, action: string, referenceId?: string) {
  const amount = XP_AMOUNTS[action]
  if (!amount) return

  try {
    const { data } = await supabaseAdmin.rpc('award_xp', {
      p_user_id: botUserId,
      p_amount: amount,
      p_action: action,
      p_reference_id: referenceId || null,
    })

    if (data?.leveled_up) {
      await supabaseAdmin.from('notifications').insert({
        user_id: botUserId,
        actor_id: botUserId,
        type: 'level_up',
        reference_id: String(data.level),
      })
    }
  } catch {
    // XP award is non-critical, don't fail the request
  }
}
