import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemType, healAmount } = await request.json()
    const userId = user.id

    if (!itemType || !healAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Call the server-side function
    const { data, error } = await supabaseAdmin.rpc('use_potion', {
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
