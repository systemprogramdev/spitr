'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User } from '@/types'

type Category = 'kills' | 'level' | 'richest' | 'liked'

interface LeaderboardEntry {
  user: User
  stat: number
}

export function LeaderboardTab() {
  const [category, setCategory] = useState<Category>('kills')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true)
      setEntries([])

      if (category === 'kills') {
        // Count kills per attacker from attack_log where target had HP go to 0
        const { data } = await supabase
          .from('attack_log')
          .select('attacker_id')
          .order('created_at', { ascending: false })
          .limit(1000)

        if (data) {
          // Count attacks per user
          const countMap: Record<string, number> = {}
          data.forEach(a => {
            countMap[a.attacker_id] = (countMap[a.attacker_id] || 0) + 1
          })

          const sorted = Object.entries(countMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 25)

          const userIds = sorted.map(([id]) => id)
          if (userIds.length > 0) {
            const { data: users } = await supabase
              .from('users')
              .select('*')
              .in('id', userIds)

            const userMap = new Map((users || []).map(u => [u.id, u]))
            setEntries(sorted
              .map(([id, count]) => ({
                user: userMap.get(id)!,
                stat: count,
              }))
              .filter(e => e.user)
            )
          }
        }
      } else if (category === 'level') {
        const { data } = await supabase
          .from('user_xp')
          .select('user_id, xp, level')
          .order('level', { ascending: false })
          .order('xp', { ascending: false })
          .limit(25)

        if (data && data.length > 0) {
          const userIds = data.map(d => d.user_id)
          const { data: users } = await supabase
            .from('users')
            .select('*')
            .in('id', userIds)

          const userMap = new Map((users || []).map(u => [u.id, u]))
          setEntries(data
            .map(d => ({
              user: userMap.get(d.user_id)!,
              stat: d.level,
            }))
            .filter(e => e.user)
          )
        }
      } else if (category === 'richest') {
        const { data } = await supabase
          .from('user_credits')
          .select('user_id, balance')
          .order('balance', { ascending: false })
          .limit(25)

        if (data && data.length > 0) {
          const userIds = data.map(d => d.user_id)
          const { data: users } = await supabase
            .from('users')
            .select('*')
            .in('id', userIds)

          const userMap = new Map((users || []).map(u => [u.id, u]))
          setEntries(data
            .map(d => ({
              user: userMap.get(d.user_id)!,
              stat: d.balance,
            }))
            .filter(e => e.user)
          )
        }
      } else if (category === 'liked') {
        // Most liked = users whose spits have the most total likes
        const { data: likes } = await supabase
          .from('likes')
          .select('spit_id')
          .limit(2000)

        if (likes && likes.length > 0) {
          const spitIds = [...new Set(likes.map(l => l.spit_id))]
          const { data: spits } = await supabase
            .from('spits')
            .select('id, user_id')
            .in('id', spitIds)

          if (spits) {
            const spitOwnerMap = new Map(spits.map(s => [s.id, s.user_id]))
            const userLikeCount: Record<string, number> = {}
            likes.forEach(l => {
              const ownerId = spitOwnerMap.get(l.spit_id)
              if (ownerId) {
                userLikeCount[ownerId] = (userLikeCount[ownerId] || 0) + 1
              }
            })

            const sorted = Object.entries(userLikeCount)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 25)

            const userIds = sorted.map(([id]) => id)
            if (userIds.length > 0) {
              const { data: users } = await supabase
                .from('users')
                .select('*')
                .in('id', userIds)

              const userMap = new Map((users || []).map(u => [u.id, u]))
              setEntries(sorted
                .map(([id, count]) => ({
                  user: userMap.get(id)!,
                  stat: count,
                }))
                .filter(e => e.user)
              )
            }
          }
        }
      }

      setIsLoading(false)
    }

    fetchLeaderboard()
  }, [category, supabase])

  const categories: { key: Category; label: string; icon: string; unit: string }[] = [
    { key: 'kills', label: 'Attacks', icon: '⚔️', unit: 'attacks' },
    { key: 'level', label: 'Level', icon: '⭐', unit: 'level' },
    { key: 'richest', label: 'Richest', icon: '💰', unit: 'spits' },
    { key: 'liked', label: 'Most Liked', icon: '❤️', unit: 'likes' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--sys-border)', overflowX: 'auto' }}>
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`btn btn-sm ${category === cat.key ? 'btn-primary' : 'btn-outline'}`}
            style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--sys-text-muted)' }}>
          No data yet
        </div>
      ) : (
        <div>
          {entries.map((entry, i) => (
            <Link
              key={entry.user.id}
              href={`/${entry.user.handle}`}
              className="spit"
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}
            >
              <span style={{
                fontFamily: 'var(--sys-font-mono)',
                fontWeight: 700,
                fontSize: '1rem',
                color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7f32' : 'var(--sys-text-muted)',
                minWidth: '28px',
                textAlign: 'center',
              }}>
                #{i + 1}
              </span>
              <div
                className="avatar"
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'var(--sys-primary)',
                  backgroundImage: entry.user.avatar_url ? `url(${entry.user.avatar_url})` : undefined,
                  flexShrink: 0,
                }}
              >
                {!entry.user.avatar_url && (
                  <span className="avatar-letter">{entry.user.name[0]?.toUpperCase()}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--sys-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.user.name}
                </div>
                <div style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem' }}>
                  @{entry.user.handle}
                </div>
              </div>
              <span style={{
                fontFamily: 'var(--sys-font-mono)',
                fontWeight: 700,
                color: 'var(--sys-primary)',
                fontSize: '0.9rem',
              }}>
                {entry.stat.toLocaleString()} {categories.find(c => c.key === category)?.unit}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
