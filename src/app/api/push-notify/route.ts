import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let vapidConfigured = false
function ensureVapid() {
  if (vapidConfigured) return
  webpush.setVapidDetails(
    'mailto:support@spitr.wtf',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  vapidConfigured = true
}

const NOTIF_LABELS: Record<string, string> = {
  follow: 'started following you',
  like: 'liked your spit',
  respit: 'respit your post',
  reply: 'replied to your spit',
  mention: 'mentioned you',
  message: 'sent you a message',
  attack: 'attacked you',
  like_reward: 'liked your spit (+1 credit)',
  transfer: 'sent you spits',
  spray: 'sprayed you',
  level_up: 'You leveled up!',
}

// Debug endpoint - check subscription status and test push
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle')
  if (!handle) return NextResponse.json({ error: 'Missing ?handle=' }, { status: 400 })

  const { data: user } = await adminClient
    .from('users')
    .select('id, handle')
    .eq('handle', handle)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: subs, count } = await adminClient
    .from('push_subscriptions')
    .select('endpoint, created_at', { count: 'exact' })
    .eq('user_id', user.id)

  const test = req.nextUrl.searchParams.get('test')
  if (test === '1' && subs && subs.length > 0) {
    ensureVapid()
    const { data: allSubs } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user.id)

    const results: any[] = []
    for (const sub of allSubs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: 'SPITr', body: 'Test push notification!', tag: 'spitr-test', url: '/notifications' })
        )
        results.push({ endpoint: sub.endpoint.slice(0, 60), status: 'sent' })
      } catch (err: any) {
        results.push({ endpoint: sub.endpoint.slice(0, 60), status: 'error', code: err.statusCode, message: err.message })
      }
    }
    return NextResponse.json({ user: user.handle, subscriptions: count, testResults: results })
  }

  return NextResponse.json({
    user: user.handle,
    subscriptions: count,
    endpoints: subs?.map(s => ({ endpoint: s.endpoint.slice(0, 60) + '...', created_at: s.created_at })),
    vapidKeySet: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    webhookSecretSet: !!process.env.WEBHOOK_SECRET,
  })
}

// Called by Supabase Database Webhook on notification INSERT
export async function POST(req: NextRequest) {
  ensureVapid()

  // Verify webhook secret
  const webhookSecret = req.headers.get('x-webhook-secret')
  if (webhookSecret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json()
  const record = payload.record

  if (!record?.user_id || !record?.type) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Get the user's push subscriptions
  const { data: subscriptions } = await adminClient
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', record.user_id)

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Get actor handle for the notification body
  let actorHandle: string | null = null
  if (record.actor_id && record.actor_id !== record.user_id) {
    const { data: actor } = await adminClient
      .from('users')
      .select('handle')
      .eq('id', record.actor_id)
      .single()
    actorHandle = actor?.handle || null
  }

  const body = actorHandle
    ? `@${actorHandle} ${NOTIF_LABELS[record.type] || 'interacted with you'}`
    : NOTIF_LABELS[record.type] || 'You have a new notification'

  const pushPayload = JSON.stringify({
    title: 'SPITr',
    body,
    tag: `spitr-${record.type}-${record.id}`,
    url: '/notifications',
  })

  // Send to all subscribed devices
  let sent = 0
  const stale: string[] = []

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload
        )
        sent++
      } catch (err: any) {
        // 410 Gone or 404 = subscription expired, clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          stale.push(sub.endpoint)
        } else {
          console.error('Push send error:', err.statusCode, err.message)
        }
      }
    })
  )

  // Clean up stale subscriptions
  if (stale.length > 0) {
    await adminClient
      .from('push_subscriptions')
      .delete()
      .in('endpoint', stale)
  }

  return NextResponse.json({ ok: true, sent })
}
