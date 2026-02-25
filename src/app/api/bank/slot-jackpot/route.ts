import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PROGRESSIVE_SEEDS } from '@/lib/slots'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('slot_jackpots')
      .select('mini_pool, major_pool, mega_pool')
      .eq('id', 'global')
      .single()

    if (!data) {
      // Table doesn't exist yet or no row — return seeds
      return NextResponse.json({
        mini: PROGRESSIVE_SEEDS.mini,
        major: PROGRESSIVE_SEEDS.major,
        mega: PROGRESSIVE_SEEDS.mega,
      })
    }

    return NextResponse.json({
      mini: Number(data.mini_pool),
      major: Number(data.major_pool),
      mega: Number(data.mega_pool),
    })
  } catch {
    return NextResponse.json({
      mini: PROGRESSIVE_SEEDS.mini,
      major: PROGRESSIVE_SEEDS.major,
      mega: PROGRESSIVE_SEEDS.mega,
    })
  }
}
