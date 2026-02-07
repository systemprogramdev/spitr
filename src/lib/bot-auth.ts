import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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
    .eq('id', botId)
    .single()

  if (botErr || !bot) {
    return { error: 'Bot not found', status: 404 }
  }

  if (!bot.is_active) {
    return { error: 'Bot is deactivated', status: 403 }
  }

  return {
    context: {
      bot,
      botUserId: bot.user_id,
    },
  }
}
