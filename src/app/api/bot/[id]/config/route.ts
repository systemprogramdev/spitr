import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: botId } = await params

    // Verify ownership
    const { data: bot, error: botErr } = await supabaseAdmin
      .from('bots')
      .select('id, owner_id')
      .eq('id', botId)
      .single()

    if (botErr || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (bot.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not your bot' }, { status: 403 })
    }

    const body = await request.json()

    // Update bots table fields
    const botUpdates: Record<string, unknown> = {}
    if (body.is_active !== undefined) botUpdates.is_active = body.is_active
    if (body.personality !== undefined) botUpdates.personality = body.personality
    if (body.name !== undefined) botUpdates.name = body.name

    if (Object.keys(botUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from('bots')
        .update(botUpdates)
        .eq('id', botId)
      if (error) {
        console.error('Update bot error:', error)
        return NextResponse.json({ error: `Bot error: ${error.message} [${error.code}]` }, { status: 500 })
      }
    }

    // Update bot_configs table fields
    const configUpdates: Record<string, unknown> = {}
    if (body.enabled_actions !== undefined) configUpdates.enabled_actions = body.enabled_actions
    if (body.target_mode !== undefined) configUpdates.target_mode = body.target_mode
    if (body.combat_strategy !== undefined) configUpdates.combat_strategy = body.combat_strategy
    if (body.banking_strategy !== undefined) configUpdates.banking_strategy = body.banking_strategy
    if (body.auto_heal_threshold !== undefined) configUpdates.auto_heal_threshold = body.auto_heal_threshold
    if (body.custom_prompt !== undefined) configUpdates.custom_prompt = body.custom_prompt

    if (Object.keys(configUpdates).length > 0) {
      // Use upsert to handle case where bot_configs row wasn't created
      const { error } = await supabaseAdmin
        .from('bot_configs')
        .upsert({ bot_id: botId, ...configUpdates }, { onConflict: 'bot_id' })
      if (error) {
        console.error('Update bot config error:', error)
        return NextResponse.json({ error: `Config error: ${error.message} [${error.code}]` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bot config update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
