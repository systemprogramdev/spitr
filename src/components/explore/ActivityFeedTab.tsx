'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from '@/lib/utils'

type ActivityType = 'attack' | 'transfer' | 'item_purchase' | 'stock' | 'lottery' | 'spray' | 'follow' | 'like' | 'respit' | 'level_up' | 'convert' | 'chest'

interface ActivityEntry {
  id: string
  type: ActivityType
  actor: { id: string; handle: string; name: string; avatar_url: string | null }
  target?: { id: string; handle: string; name: string; avatar_url: string | null } | null
  detail: string
  created_at: string
}

const ACTIVITY_ICON: Record<ActivityType, string> = {
  attack: '⚔️',
  transfer: '💸',
  item_purchase: '🛒',
  stock: '📈',
  lottery: '🎰',
  spray: '🎨',
  follow: '👥',
  like: '❤️',
  respit: '🔁',
  level_up: '⬆️',
  convert: '🔄',
  chest: '🎁',
}

const WEAPON_EMOJI: Record<string, string> = {
  knife: '🔪',
  gun: '🔫',
  soldier: '💂',
  drone: '🤖',
  nuke: '☢️',
}

export function ActivityFeedTab() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchActivity = useCallback(async () => {
    // Query all 12 tables in parallel
    const [attackRes, creditRes, goldRes, stockRes, lotteryRes, sprayRes, followRes, likeRes, respitRes, levelUpRes, convertRes, chestRes] = await Promise.all([
      supabase
        .from('attack_log')
        .select('id, attacker_id, target_user_id, target_spit_id, item_type, damage, created_at')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('credit_transactions')
        .select('id, user_id, type, amount, reference_id, created_at')
        .eq('type', 'transfer_sent')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('gold_transactions')
        .select('id, user_id, type, amount, reference_id, created_at')
        .eq('type', 'item_purchase')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('stock_transactions')
        .select('id, user_id, type, shares, price_per_share, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('lottery_tickets')
        .select('id, user_id, ticket_type, prize_amount, prize_currency, scratched, is_winner, created_at')
        .eq('scratched', true)
        .eq('is_winner', true)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('spray_paints')
        .select('id, sprayer_id, target_user_id, sprayed_at')
        .order('sprayed_at', { ascending: false })
        .limit(10),
      supabase
        .from('follows')
        .select('follower_id, following_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('likes')
        .select('user_id, spit_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('respits')
        .select('user_id, spit_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('credit_transactions')
        .select('id, user_id, type, amount, reference_id, created_at')
        .eq('type', 'level_up')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('credit_transactions')
        .select('id, user_id, type, amount, reference_id, created_at')
        .eq('type', 'convert')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('user_chests')
        .select('id, user_id, opened, loot, opened_at')
        .eq('opened', true)
        .not('opened_at', 'is', null)
        .order('opened_at', { ascending: false })
        .limit(10),
    ])

    // Collect all unique user IDs
    const userIds = new Set<string>()

    const attacks = attackRes.data || []
    const credits = creditRes.data || []
    const golds = goldRes.data || []
    const stocks = stockRes.data || []
    const lotteries = lotteryRes.data || []
    const sprays = sprayRes.data || []
    const follows = followRes.data || []
    const likes = likeRes.data || []
    const respits = respitRes.data || []
    const levelUps = levelUpRes.data || []
    const converts = convertRes.data || []
    const chests = chestRes.data || []

    attacks.forEach(a => {
      userIds.add(a.attacker_id)
      if (a.target_user_id) userIds.add(a.target_user_id)
    })

    // For spit targets, get spit owners
    const spitTargetIds = attacks.filter(a => a.target_spit_id).map(a => a.target_spit_id!)
    // Also need spit owners for likes/respits
    const likeSpitIds = likes.map(l => l.spit_id)
    const respitSpitIds = respits.map(r => r.spit_id)
    const allSpitIds = [...spitTargetIds, ...likeSpitIds, ...respitSpitIds]
    let spitOwnerMap: Record<string, string> = {}
    if (allSpitIds.length > 0) {
      const { data: spitData } = await supabase
        .from('spits')
        .select('id, user_id')
        .in('id', allSpitIds)
      if (spitData) {
        spitOwnerMap = Object.fromEntries(spitData.map(s => [s.id, s.user_id]))
        spitData.forEach(s => userIds.add(s.user_id))
      }
    }

    credits.forEach(c => {
      userIds.add(c.user_id)
      if (c.reference_id) userIds.add(c.reference_id)
    })
    golds.forEach(g => userIds.add(g.user_id))
    stocks.forEach(s => userIds.add(s.user_id))
    lotteries.forEach(l => userIds.add(l.user_id))
    sprays.forEach(s => {
      userIds.add(s.sprayer_id)
      userIds.add(s.target_user_id)
    })
    follows.forEach(f => {
      userIds.add(f.follower_id)
      userIds.add(f.following_id)
    })
    likes.forEach(l => userIds.add(l.user_id))
    respits.forEach(r => userIds.add(r.user_id))
    levelUps.forEach(l => userIds.add(l.user_id))
    converts.forEach(c => userIds.add(c.user_id))
    chests.forEach(c => userIds.add(c.user_id))

    // Batch fetch all users
    const { data: users } = await supabase
      .from('users')
      .select('id, handle, name, avatar_url')
      .or('account_type.neq.sybil,account_type.is.null')
      .in('id', [...userIds])

    const userMap = new Map((users || []).map(u => [u.id, u]))
    const getUser = (id: string) => userMap.get(id) || { id, handle: '???', name: 'Unknown', avatar_url: null }

    // Build unified entries
    const allEntries: ActivityEntry[] = []

    // Attacks
    attacks.forEach(a => {
      const targetUserId = a.target_user_id || (a.target_spit_id ? spitOwnerMap[a.target_spit_id] : null)
      const weapon = WEAPON_EMOJI[a.item_type] || '⚔️'
      allEntries.push({
        id: `atk-${a.id}`,
        type: 'attack',
        actor: getUser(a.attacker_id),
        target: targetUserId ? getUser(targetUserId) : null,
        detail: `${weapon} -${a.damage}HP`,
        created_at: a.created_at,
      })
    })

    // Transfers
    credits.forEach(c => {
      allEntries.push({
        id: `txn-${c.id}`,
        type: 'transfer',
        actor: getUser(c.user_id),
        target: c.reference_id ? getUser(c.reference_id) : null,
        detail: `sent ${Math.abs(c.amount).toLocaleString()} spits`,
        created_at: c.created_at,
      })
    })

    // Gold item purchases
    golds.forEach(g => {
      allEntries.push({
        id: `gold-${g.id}`,
        type: 'item_purchase',
        actor: getUser(g.user_id),
        detail: `bought item for ${Math.abs(g.amount).toLocaleString()} gold`,
        created_at: g.created_at,
      })
    })

    // Stock trades
    stocks.forEach(s => {
      const action = s.type === 'buy' ? 'bought' : 'sold'
      const shares = Number(s.shares)
      const price = Number(s.price_per_share)
      allEntries.push({
        id: `stk-${s.id}`,
        type: 'stock',
        actor: getUser(s.user_id),
        detail: `${action} ${shares.toLocaleString()} shares @ $${price.toFixed(2)}`,
        created_at: s.created_at,
      })
    })

    // Lottery wins
    lotteries.forEach(l => {
      const prize = Number(l.prize_amount)
      allEntries.push({
        id: `lot-${l.id}`,
        type: 'lottery',
        actor: getUser(l.user_id),
        detail: `won ${prize.toLocaleString()} ${l.prize_currency}!`,
        created_at: l.created_at,
      })
    })

    // Spray paints
    sprays.forEach(s => {
      allEntries.push({
        id: `spr-${s.id}`,
        type: 'spray',
        actor: getUser(s.sprayer_id),
        target: getUser(s.target_user_id),
        detail: `spray-painted`,
        created_at: s.sprayed_at,
      })
    })

    // Follows
    follows.forEach(f => {
      allEntries.push({
        id: `fol-${f.follower_id}-${f.following_id}`,
        type: 'follow',
        actor: getUser(f.follower_id),
        target: getUser(f.following_id),
        detail: 'followed',
        created_at: f.created_at,
      })
    })

    // Likes
    likes.forEach(l => {
      const spitOwner = spitOwnerMap[l.spit_id]
      allEntries.push({
        id: `lik-${l.user_id}-${l.spit_id}`,
        type: 'like',
        actor: getUser(l.user_id),
        target: spitOwner ? getUser(spitOwner) : null,
        detail: 'liked a spit by',
        created_at: l.created_at,
      })
    })

    // Respits
    respits.forEach(r => {
      const spitOwner = spitOwnerMap[r.spit_id]
      allEntries.push({
        id: `rsp-${r.user_id}-${r.spit_id}`,
        type: 'respit',
        actor: getUser(r.user_id),
        target: spitOwner ? getUser(spitOwner) : null,
        detail: "respit'd",
        created_at: r.created_at,
      })
    })

    // Level ups
    levelUps.forEach(l => {
      allEntries.push({
        id: `lvl-${l.id}`,
        type: 'level_up',
        actor: getUser(l.user_id),
        detail: `leveled up! (+${Math.abs(l.amount).toLocaleString()} spits)`,
        created_at: l.created_at,
      })
    })

    // Conversions
    converts.forEach(c => {
      const amt = Math.abs(c.amount)
      allEntries.push({
        id: `cvt-${c.id}`,
        type: 'convert',
        actor: getUser(c.user_id),
        detail: c.amount < 0 ? `converted ${amt.toLocaleString()} spits to gold` : `converted gold to ${amt.toLocaleString()} spits`,
        created_at: c.created_at,
      })
    })

    // Chest opens
    chests.forEach(c => {
      allEntries.push({
        id: `cht-${c.id}`,
        type: 'chest',
        actor: getUser(c.user_id),
        detail: 'opened a treasure chest',
        created_at: c.opened_at!,
      })
    })

    // Sort by created_at DESC, take top 50
    allEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setEntries(allEntries.slice(0, 50))
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchActivity()

    const interval = setInterval(fetchActivity, 30000)
    return () => clearInterval(interval)
  }, [fetchActivity])

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--sys-text-muted)' }}>
        No activity yet. The platform is quiet...
      </div>
    )
  }

  return (
    <div>
      {entries.map((entry) => (
        <div key={entry.id} className={`spit activity-entry activity-${entry.type}`}>
          <span className="activity-icon">{ACTIVITY_ICON[entry.type]}</span>
          <Link href={`/${entry.actor.handle}`} className="activity-actor">
            @{entry.actor.handle}
          </Link>
          <span className="activity-detail">{entry.detail}</span>
          {entry.target && (
            <>
              {entry.type !== 'like' && entry.type !== 'respit' && entry.type !== 'spray' && entry.type !== 'follow' && (
                <span className="activity-detail">to</span>
              )}
              <Link href={`/${entry.target.handle}`} className="activity-target">
                @{entry.target.handle}
              </Link>
            </>
          )}
          <span className="activity-time">
            {formatDistanceToNow(entry.created_at)}
          </span>
        </div>
      ))}
    </div>
  )
}
