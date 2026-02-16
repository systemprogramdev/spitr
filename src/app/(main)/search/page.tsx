'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { User, SpitWithAuthor } from '@/types'
import { Spit } from '@/components/spit'
import { enrichSpitsWithCounts } from '@/lib/spitUtils'
import { LeaderboardTab } from '@/components/explore/LeaderboardTab'
import { KillFeedTab } from '@/components/explore/KillFeedTab'
import { ActivityFeedTab } from '@/components/explore/ActivityFeedTab'

type ExploreTab = 'activity' | 'leaderboard' | 'killfeed' | 'who-to-follow'

export default function SearchPage() {
  const { user } = useAuthStore()
  const [query, setQuery] = useState('')
  const [searchTab, setSearchTab] = useState<'users' | 'spits'>('users')
  const [exploreTab, setExploreTab] = useState<ExploreTab>('activity')
  const [users, setUsers] = useState<User[]>([])
  const [spits, setSpits] = useState<SpitWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [whoToFollow, setWhoToFollow] = useState<User[]>([])
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())
  const [followLoading, setFollowLoading] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Fetch who-to-follow list when tab selected
  const fetchWhoToFollow = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('users')
      .select('*')
      .or('account_type.neq.sybil,account_type.is.null')
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      const filtered = data.filter((u) => u.id !== user.id)
      setWhoToFollow(filtered)

      // Fetch which ones we already follow
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', filtered.map((u) => u.id))

      if (follows) {
        setFollowingSet(new Set(follows.map((f) => f.following_id)))
      }
    }
  }, [user, supabase])

  useEffect(() => {
    if (exploreTab === 'who-to-follow') {
      fetchWhoToFollow()
    }
  }, [exploreTab, fetchWhoToFollow])

  const handleFollow = async (targetId: string) => {
    if (!user) return
    setFollowLoading(targetId)

    if (followingSet.has(targetId)) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId)

      setFollowingSet((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
    } else {
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: targetId,
      })

      setFollowingSet((prev) => new Set(prev).add(targetId))
    }

    setFollowLoading(null)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    setHasSearched(true)

    if (searchTab === 'users') {
      const { data } = await supabase
        .from('users')
        .select('*')
        .or('account_type.neq.sybil,account_type.is.null')
        .or(`handle.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(20)

      setUsers(data || [])
    } else {
      const { data } = await supabase
        .from('spits')
        .select('*, author:users!spits_user_id_fkey(*)')
        .ilike('content', `%${query}%`)
        .is('reply_to_id', null)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) {
        const enriched = await enrichSpitsWithCounts(data, user?.id)
        setSpits(enriched)
      }
    }

    setIsLoading(false)
  }

  const clearSearch = () => {
    setQuery('')
    setHasSearched(false)
    setUsers([])
    setSpits([])
  }

  const exploreTabs: { key: ExploreTab; label: string; icon: string }[] = [
    { key: 'activity', label: 'Activity', icon: '⚡' },
    { key: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { key: 'killfeed', label: 'Kill Feed', icon: '⚔️' },
    { key: 'who-to-follow', label: 'Follow', icon: '👥' },
  ]

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span className="sys-icon sys-icon-search" style={{ marginRight: '0.5rem' }}></span>
          Explore
        </h1>
      </header>

      <div style={{ padding: '1rem', borderBottom: '1px solid var(--sys-border)' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SPITr..."
              style={{ flex: 1 }}
            />
            {hasSearched ? (
              <button type="button" onClick={clearSearch} className="btn" style={{ background: 'var(--sys-surface)' }}>
                Clear
              </button>
            ) : null}
            <button type="submit" className="btn btn-primary btn-glow" disabled={isLoading}>
              Search
            </button>
          </div>
        </form>

        {hasSearched ? (
          <div className="tabs" style={{ display: 'flex', gap: '0', marginTop: '1rem' }}>
            <button
              onClick={() => setSearchTab('users')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: searchTab === 'users' ? '2px solid var(--sys-primary)' : '2px solid transparent',
                color: searchTab === 'users' ? 'var(--sys-primary)' : 'var(--sys-text-muted)',
                fontFamily: 'var(--sys-font-mono)',
              }}
            >
              Users
            </button>
            <button
              onClick={() => setSearchTab('spits')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: searchTab === 'spits' ? '2px solid var(--sys-primary)' : '2px solid transparent',
                color: searchTab === 'spits' ? 'var(--sys-primary)' : 'var(--sys-text-muted)',
                fontFamily: 'var(--sys-font-mono)',
              }}
            >
              Spits
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0', marginTop: '1rem' }}>
            {exploreTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setExploreTab(t.key)}
                style={{
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: exploreTab === t.key ? '2px solid var(--sys-primary)' : '2px solid transparent',
                  color: exploreTab === t.key ? 'var(--sys-primary)' : 'var(--sys-text-muted)',
                  fontFamily: 'var(--sys-font-mono)',
                  fontSize: '0.85rem',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem', color: 'var(--sys-text-muted)' }}>Searching...</p>
        </div>
      ) : hasSearched ? (
        // Search results
        searchTab === 'users' ? (
          users.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--sys-text-muted)' }}>No users found for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div>
              {users.map((u) => (
                <Link
                  key={u.id}
                  href={`/${u.handle}`}
                  className="spit"
                  style={{ display: 'flex', gap: '0.75rem' }}
                >
                  <div
                    className="avatar"
                    style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: 'var(--sys-primary)',
                      backgroundImage: u.avatar_url ? `url(${u.avatar_url})` : undefined,
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--sys-text)' }}>{u.name}</div>
                    <div style={{ color: 'var(--sys-text-muted)' }}>@{u.handle}</div>
                    {u.bio && (
                      <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--sys-text-muted)' }}>
                        {u.bio}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : spits.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--sys-text-muted)' }}>No spits found for &quot;{query}&quot;</p>
          </div>
        ) : (
          <div>
            {spits.map((spit) => (
              <Spit key={spit.id} spit={spit} />
            ))}
          </div>
        )
      ) : (
        // Explore tabs
        exploreTab === 'leaderboard' ? (
          <LeaderboardTab />
        ) : exploreTab === 'killfeed' ? (
          <KillFeedTab />
        ) : exploreTab === 'who-to-follow' ? (
          <div>
            {whoToFollow.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--sys-text-muted)' }}>
                Loading...
              </div>
            ) : (
              whoToFollow.map((u) => (
                <div key={u.id} className="who-to-follow-item" style={{ padding: '0.75rem 1rem' }}>
                  <Link href={`/${u.handle}`} style={{ display: 'contents', textDecoration: 'none' }}>
                    <div
                      className="who-to-follow-avatar"
                      style={{
                        width: '44px',
                        height: '44px',
                        backgroundImage: u.avatar_url ? `url(${u.avatar_url})` : undefined,
                      }}
                    >
                      {!u.avatar_url && (
                        <span>{u.name[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="who-to-follow-info" style={{ flex: 1 }}>
                      <div className="who-to-follow-name">{u.name}</div>
                      <div className="who-to-follow-handle">@{u.handle}</div>
                      {u.bio && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--sys-text-muted)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.bio}
                        </div>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => handleFollow(u.id)}
                    disabled={followLoading === u.id}
                    className={`btn ${followingSet.has(u.id) ? 'btn-outline' : 'btn-primary btn-glow'}`}
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', flexShrink: 0 }}
                  >
                    {followingSet.has(u.id) ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <ActivityFeedTab />
        )
      )}
    </div>
  )
}
