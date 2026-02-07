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
      .select('id, owner_id, user_id')
      .eq('id', botId)
      .single()

    if (botErr || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (bot.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not your bot' }, { status: 403 })
    }

    const formData = await request.formData()
    const name = formData.get('name') as string | null
    const bio = formData.get('bio') as string | null
    const avatarFile = formData.get('avatar') as File | null
    const bannerFile = formData.get('banner') as File | null

    // Validate files
    if (avatarFile && avatarFile.size > 0) {
      if (!avatarFile.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Avatar must be an image' }, { status: 400 })
      }
      if (avatarFile.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'Avatar must be under 2MB' }, { status: 400 })
      }
    }

    if (bannerFile && bannerFile.size > 0) {
      if (!bannerFile.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Banner must be an image' }, { status: 400 })
      }
      if (bannerFile.size > 4 * 1024 * 1024) {
        return NextResponse.json({ error: 'Banner must be under 4MB' }, { status: 400 })
      }
    }

    const userUpdates: Record<string, unknown> = {}
    const botUpdates: Record<string, unknown> = {}

    // Upload avatar
    if (avatarFile && avatarFile.size > 0) {
      const ext = avatarFile.name.split('.').pop()
      const fileName = `${bot.user_id}-${Date.now()}.${ext}`
      const buffer = Buffer.from(await avatarFile.arrayBuffer())

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('avatars')
        .upload(fileName, buffer, {
          contentType: avatarFile.type,
          upsert: true,
        })

      if (uploadErr) {
        console.error('Avatar upload error:', uploadErr)
        return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
      }

      const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName)
      userUpdates.avatar_url = urlData.publicUrl
    }

    // Upload banner
    if (bannerFile && bannerFile.size > 0) {
      const ext = bannerFile.name.split('.').pop()
      const fileName = `${bot.user_id}-${Date.now()}.${ext}`
      const buffer = Buffer.from(await bannerFile.arrayBuffer())

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('banners')
        .upload(fileName, buffer, {
          contentType: bannerFile.type,
          upsert: true,
        })

      if (uploadErr) {
        console.error('Banner upload error:', uploadErr)
        return NextResponse.json({ error: 'Failed to upload banner' }, { status: 500 })
      }

      const { data: urlData } = supabaseAdmin.storage.from('banners').getPublicUrl(fileName)
      userUpdates.banner_url = urlData.publicUrl
    }

    // Text fields
    if (name !== null) {
      const trimmed = name.trim()
      if (trimmed) {
        userUpdates.name = trimmed
        botUpdates.name = trimmed
      }
    }

    if (bio !== null) {
      userUpdates.bio = bio.trim() || null
    }

    // Update bot's user row
    if (Object.keys(userUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from('users')
        .update(userUpdates)
        .eq('id', bot.user_id)

      if (error) {
        console.error('Update bot user error:', error)
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
      }
    }

    // Keep bots.name in sync
    if (Object.keys(botUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from('bots')
        .update(botUpdates)
        .eq('id', botId)

      if (error) {
        console.error('Update bot name error:', error)
      }
    }

    return NextResponse.json({ success: true, updates: userUpdates })
  } catch (error) {
    console.error('Bot profile update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
