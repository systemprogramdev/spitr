import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SPIT_COST = 1000
const GOLD_COST = 100

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, handle, personality, paymentMethod } = await request.json()

    if (!name || !handle || !personality || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (paymentMethod !== 'spits' && paymentMethod !== 'gold') {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    // Validate handle format
    const handleRegex = /^[a-z0-9_]{3,20}$/
    if (!handleRegex.test(handle)) {
      return NextResponse.json(
        { error: 'Handle must be 3-20 characters, lowercase alphanumeric and underscores only' },
        { status: 400 }
      )
    }

    // Check handle uniqueness
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('handle', handle)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'Handle already taken' }, { status: 409 })
    }

    // Deduct payment
    if (paymentMethod === 'spits') {
      const { data: credits } = await supabaseAdmin
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      if (!credits || credits.balance < SPIT_COST) {
        return NextResponse.json({ error: 'Insufficient spits' }, { status: 400 })
      }

      const { error: deductErr } = await supabaseAdmin
        .from('user_credits')
        .update({ balance: credits.balance - SPIT_COST })
        .eq('user_id', user.id)

      if (deductErr) {
        return NextResponse.json({ error: 'Failed to deduct spits' }, { status: 500 })
      }

      await supabaseAdmin.from('credit_transactions').insert({
        user_id: user.id,
        type: 'purchase',
        amount: -SPIT_COST,
        balance_after: credits.balance - SPIT_COST,
        reference_id: 'bot_purchase',
      })
    } else {
      const { data: gold } = await supabaseAdmin
        .from('user_gold')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      if (!gold || gold.balance < GOLD_COST) {
        return NextResponse.json({ error: 'Insufficient gold' }, { status: 400 })
      }

      const { error: deductErr } = await supabaseAdmin
        .from('user_gold')
        .update({ balance: gold.balance - GOLD_COST })
        .eq('user_id', user.id)

      if (deductErr) {
        return NextResponse.json({ error: 'Failed to deduct gold' }, { status: 500 })
      }

      await supabaseAdmin.from('gold_transactions').insert({
        user_id: user.id,
        type: 'purchase',
        amount: -GOLD_COST,
        balance_after: gold.balance - GOLD_COST,
        reference_id: 'bot_purchase',
      })
    }

    // Create auth user for the bot
    let botAuthUser
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: `bot_${handle}@spitr.bot`,
        password: crypto.randomUUID(),
        email_confirm: true,
      })

      if (authErr || !authData.user) {
        throw new Error(authErr?.message || 'Failed to create bot auth user')
      }

      botAuthUser = authData.user
    } catch (err) {
      // Refund payment on failure
      if (paymentMethod === 'spits') {
        const { data: credits } = await supabaseAdmin
          .from('user_credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()
        if (credits) {
          await supabaseAdmin.from('user_credits')
            .update({ balance: credits.balance + SPIT_COST })
            .eq('user_id', user.id)
        }
      } else {
        const { data: gold } = await supabaseAdmin
          .from('user_gold')
          .select('balance')
          .eq('user_id', user.id)
          .single()
        if (gold) {
          await supabaseAdmin.from('user_gold')
            .update({ balance: gold.balance + GOLD_COST })
            .eq('user_id', user.id)
        }
      }
      console.error('Bot auth creation error:', err)
      return NextResponse.json({ error: 'Failed to create bot user' }, { status: 500 })
    }

    const botUserId = botAuthUser.id

    try {
      // Create user profile
      await supabaseAdmin.from('users').insert({
        id: botUserId,
        handle,
        name,
        bio: `Bot: ${personality}`,
        hp: 5000,
      })

      // Create user_credits
      await supabaseAdmin.from('user_credits').insert({
        user_id: botUserId,
        balance: 100,
      })

      // Create user_gold
      await supabaseAdmin.from('user_gold').insert({
        user_id: botUserId,
        balance: 0,
      })

      // Create user_xp
      await supabaseAdmin.from('user_xp').insert({
        user_id: botUserId,
        xp: 0,
        level: 1,
      })

      // Create bot record
      const { data: bot, error: botErr } = await supabaseAdmin
        .from('bots')
        .insert({
          owner_id: user.id,
          user_id: botUserId,
          name,
          handle,
          personality,
        })
        .select()
        .single()

      if (botErr) throw botErr

      // Create bot_configs with defaults
      await supabaseAdmin.from('bot_configs').insert({
        bot_id: bot.id,
      })

      return NextResponse.json({
        success: true,
        bot: {
          id: bot.id,
          name,
          handle,
          personality,
          user_id: botUserId,
        },
      })
    } catch (err) {
      // Cleanup on failure: delete the auth user
      console.error('Bot setup error:', err)
      try { await supabaseAdmin.auth.admin.deleteUser(botUserId) } catch {}
      try { await supabaseAdmin.from('users').delete().eq('id', botUserId) } catch {}
      return NextResponse.json({ error: 'Failed to set up bot' }, { status: 500 })
    }
  } catch (error) {
    console.error('Bot purchase error:', error)
    return NextResponse.json({ error: 'Purchase failed' }, { status: 500 })
  }
}
