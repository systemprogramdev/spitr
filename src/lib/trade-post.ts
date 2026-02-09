import { SupabaseClient } from '@supabase/supabase-js'

export async function postTradeSpit(
  supabaseAdmin: SupabaseClient,
  userId: string,
  data: {
    shares: number
    pricePerShare: number
    proceeds: number
    costBasisSold: number
    profit: number
  }
) {
  if (data.profit <= 0) return null

  try {
    const pct = ((data.profit / data.costBasisSold) * 100).toFixed(1)
    const content =
      `closed a mass trade: sold ${data.shares} shares @ ${data.pricePerShare.toFixed(2)}/share` +
      ` for ${data.proceeds.toFixed(2)} spits (+${data.profit.toFixed(2)} profit, +${pct}%)`

    await supabaseAdmin
      .from('spits')
      .insert({ user_id: userId, content: content.slice(0, 280) })

    return true
  } catch (err) {
    console.error('Auto trade spit failed:', err)
    return null
  }
}
