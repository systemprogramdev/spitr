import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP, rejectSybil } from '@/lib/bot-auth'
import { getStockPrice } from '@/lib/bank'
import { postTradeSpit } from '@/lib/trade-post'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })
  const blocked = rejectSybil(context); if (blocked) return blocked

  const { botUserId } = context

  try {
    const body = await request.json()
    const action = body.action // 'buy' or 'sell'

    const pricePerShare = getStockPrice()

    if (action === 'buy') {
      const spitAmount = body.spitAmount || body.spit_amount || body.amount
      if (!spitAmount || spitAmount <= 0) {
        return NextResponse.json({ error: 'Invalid spit amount' }, { status: 400 })
      }

      const { data, error: rpcErr } = await supabaseAdmin.rpc('bank_buy_stock', {
        p_user_id: botUserId,
        p_spit_amount: spitAmount,
        p_price_per_share: pricePerShare,
      })

      if (rpcErr) {
        console.error('Bot buy stock RPC error:', rpcErr)
        return NextResponse.json({ error: rpcErr.message }, { status: 500 })
      }

      if (!data.success) {
        return NextResponse.json({ error: data.error }, { status: 400 })
      }

      awardBotXP(botUserId, 'stock_buy')

      return NextResponse.json({
        success: true,
        sharesBought: data.shares_bought,
        totalShares: data.total_shares,
        spent: data.spent,
        pricePerShare,
      })

    } else if (action === 'sell') {
      const shares = body.shares || body.amount
      if (!shares || shares <= 0) {
        return NextResponse.json({ error: 'Invalid shares amount' }, { status: 400 })
      }

      const { data, error: rpcErr } = await supabaseAdmin.rpc('bank_sell_stock', {
        p_user_id: botUserId,
        p_shares: shares,
        p_price_per_share: pricePerShare,
      })

      if (rpcErr) {
        console.error('Bot sell stock RPC error:', rpcErr)
        return NextResponse.json({ error: rpcErr.message }, { status: 500 })
      }

      if (!data.success) {
        return NextResponse.json({ error: data.error }, { status: 400 })
      }

      awardBotXP(botUserId, 'stock_sell')

      if (data.profit > 0) {
        postTradeSpit(supabaseAdmin, botUserId, {
          shares: data.shares_sold,
          pricePerShare,
          proceeds: data.proceeds,
          costBasisSold: data.cost_basis_sold,
          profit: data.profit,
        })
      }

      return NextResponse.json({
        success: true,
        sharesSold: data.shares_sold,
        proceeds: data.proceeds,
        remainingShares: data.remaining_shares,
        pricePerShare,
      })

    } else {
      return NextResponse.json({ error: 'Invalid action. Use buy or sell' }, { status: 400 })
    }
  } catch (err) {
    console.error('Bot stock error:', err)
    return NextResponse.json({ error: 'Stock operation failed' }, { status: 500 })
  }
}
