'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from '@/lib/utils'

interface KillFeedEntry {
  id: string
  attacker: { id: string; handle: string; name: string; avatar_url: string | null }
  target: { id: string; handle: string; name: string; avatar_url: string | null } | null
  item_type: string
  damage: number
  created_at: string
}

const WEAPON_EMOJI: Record<string, string> = {
  knife: '🔪',
  gun: '🔫',
  soldier: '💂',
  drone: '🤖',
}

export function KillFeedTab() {
  const [entries, setEntries] = useState<KillFeedEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchKillFeed = useCallback(async () => {
    const { data } = await supabase
      .from('attack_log')
      .select(`
        id,
        attacker_id,
        target_user_id,
        target_spit_id,
        item_type,
        damage,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data || data.length === 0) {
      setEntries([])
      setIsLoading(false)
      return
    }

    // Collect all user IDs
    const userIds = new Set<string>()
    data.forEach(d => {
      userIds.add(d.attacker_id)
      if (d.target_user_id) userIds.add(d.target_user_id)
    })

    // For spit targets, get the spit owners
    const spitTargetIds = data.filter(d => d.target_spit_id).map(d => d.target_spit_id!)
    let spitOwnerMap: Record<string, string> = {}
    if (spitTargetIds.length > 0) {
      const { data: spits } = await supabase
        .from('spits')
        .select('id, user_id')
        .in('id', spitTargetIds)
      if (spits) {
        spitOwnerMap = Object.fromEntries(spits.map(s => [s.id, s.user_id]))
        spits.forEach(s => userIds.add(s.user_id))
      }
    }

    // Fetch all users
    const { data: users } = await supabase
      .from('users')
      .select('id, handle, name, avatar_url')
      .neq('account_type', 'sybil')
      .in('id', [...userIds])

    const userMap = new Map((users || []).map(u => [u.id, u]))

    const enriched: KillFeedEntry[] = data.map(d => {
      const targetUserId = d.target_user_id || (d.target_spit_id ? spitOwnerMap[d.target_spit_id] : null)
      return {
        id: d.id,
        attacker: userMap.get(d.attacker_id) || { id: d.attacker_id, handle: '???', name: 'Unknown', avatar_url: null },
        target: targetUserId ? (userMap.get(targetUserId) || { id: targetUserId, handle: '???', name: 'Unknown', avatar_url: null }) : null,
        item_type: d.item_type,
        damage: d.damage,
        created_at: d.created_at,
      }
    })

    setEntries(enriched)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchKillFeed()

    // Auto-refresh every 30s
    const interval = setInterval(fetchKillFeed, 30000)
    return () => clearInterval(interval)
  }, [fetchKillFeed])

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
        No attacks yet. Be the first to strike!
      </div>
    )
  }

  return (
    <div>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="spit"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        >
          <Link href={`/${entry.attacker.handle}`} style={{ fontWeight: 600, color: 'var(--sys-danger)' }}>
            @{entry.attacker.handle}
          </Link>
          <span>{WEAPON_EMOJI[entry.item_type] || '⚔️'}</span>
          {entry.target ? (
            <Link href={`/${entry.target.handle}`} style={{ fontWeight: 600, color: 'var(--sys-text)' }}>
              @{entry.target.handle}
            </Link>
          ) : (
            <span style={{ color: 'var(--sys-text-muted)' }}>unknown</span>
          )}
          <span style={{ color: 'var(--sys-danger)', fontFamily: 'var(--sys-font-mono)', fontWeight: 700 }}>
            -{entry.damage}HP
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--sys-text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
            {formatDistanceToNow(entry.created_at)}
          </span>
        </div>
      ))}
    </div>
  )
}
