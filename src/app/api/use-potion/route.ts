import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId, itemType, healAmount } = await request.json()

    if (!userId || !itemType || !healAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Call the server-side function
    const { data, error } = await supabase.rpc('use_potion', {
      p_user_id: userId,
      p_item_type: itemType,
      p_heal_amount: healAmount,
    })

    if (error) {
      console.error('Potion RPC error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const result = data as { success: boolean; error?: string; new_hp?: number; healed?: number }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Potion use failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      newHp: result.new_hp,
      healed: result.healed,
    })
  } catch (error) {
    console.error('Use potion error:', error)
    return NextResponse.json(
      { error: 'Failed to use potion' },
      { status: 500 }
    )
  }
}
