import { NextRequest, NextResponse } from 'next/server'
import { validateDatacenterKey, supabaseAdmin } from '@/lib/bot-auth'
import crypto from 'crypto'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB

export async function POST(request: NextRequest) {
  const auth = await validateDatacenterKey(request)
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 4MB)' }, { status: 413 })
    }

    const ext = file.name.split('.').pop() || 'png'
    const fileName = `sybil_${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadErr) {
      console.error('Sybil image upload error:', uploadErr)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error('Sybil upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
