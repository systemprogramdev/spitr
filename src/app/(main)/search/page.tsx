'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { User, SpitWithAuthor } from '@/types'
import { Spit } from '@/components/spit'

export default function SearchPage() {
  const { user } = useAuthStore()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'users' | 'spits'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [spits, setSpits] = useState<SpitWithAuthor[]>([])
  const [discoverSpits, setDiscoverSpits] = useState<SpitWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(true)
  const [hasSearched, setHasSearched] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  // Fetch discover spits on mount
  useEffect(() => {
    const fetchDiscoverSpits = async () => {
      // Get users the current user follows
      let followingIds: string[] = []
      if (user) {
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
        followingIds = following?.map(f => f.following_id) || []
        followingIds.push(user.id) // Also exclude own spits
      }

      // Get random spits from people not followed
      let query = supabase
        .from('spits')
        .select(`
          *,
          author:users!spits_user_id_fkey(*)
        `)
        .is('reply_to_id', null)
        .order('created_at', { ascending: false })
        .limit(20)

      if (followingIds.length > 0) {
        query = query.not('user_id', 'in', `(${followingIds.join(',')})`)
      }

      const { data } = await query

      if (data) {
        // Add counts and interaction state
        const spitsWithCounts = await Promise.all(
          data.map(async (spit) => {
            const [likesResult, respitsResult, repliesResult] = await Promise.all([
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('spit_id', spit.id),
              supabase.from('respits').select('*', { count: 'exact', head: true }).eq('spit_id', spit.id),
              supabase.from('spits').select('*', { count: 'exact', head: true }).eq('reply_to_id', spit.id),
            ])

            let isLiked = false
            let isRespit = false
            if (user) {
              const [likeCheck, respitCheck] = await Promise.all([
                supabase.from('likes').select('*').eq('spit_id', spit.id).eq('user_id', user.id).single(),
                supabase.from('respits').select('*').eq('spit_id', spit.id).eq('user_id', user.id).single(),
              ])
              isLiked = !!likeCheck.data
              isRespit = !!respitCheck.data
            }

            return {
              ...spit,
              like_count: likesResult.count || 0,
              respit_count: respitsResult.count || 0,
              reply_count: repliesResult.count || 0,
              is_liked: isLiked,
              is_respit: isRespit,
            } as SpitWithAuthor
          })
        )
        setDiscoverSpits(spitsWithCounts)
      }
      setIsLoadingDiscover(false)
    }

    fetchDiscoverSpits()
  }, [user, supabase])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    setHasSearched(true)

    if (tab === 'users') {
      const { data } = await supabase
        .from('users')
        .select('*')
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
        const spitsWithCounts = await Promise.all(
          data.map(async (spit) => {
            const [likesResult, respitsResult, repliesResult] = await Promise.all([
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('spit_id', spit.id),
              supabase.from('respits').select('*', { count: 'exact', head: true }).eq('spit_id', spit.id),
              supabase.from('spits').select('*', { count: 'exact', head: true }).eq('reply_to_id', spit.id),
            ])

            let isLiked = false
            let isRespit = false
            if (user) {
              const [likeCheck, respitCheck] = await Promise.all([
                supabase.from('likes').select('*').eq('spit_id', spit.id).eq('user_id', user.id).single(),
                supabase.from('respits').select('*').eq('spit_id', spit.id).eq('user_id', user.id).single(),
              ])
              isLiked = !!likeCheck.data
              isRespit = !!respitCheck.data
            }

            return {
              ...spit,
              like_count: likesResult.count || 0,
              respit_count: respitsResult.count || 0,
              reply_count: repliesResult.count || 0,
              is_liked: isLiked,
              is_respit: isRespit,
            } as SpitWithAuthor
          })
        )
        setSpits(spitsWithCounts)
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

        {hasSearched && (
          <div className="tabs" style={{ display: 'flex', gap: '0', marginTop: '1rem' }}>
            <button
              onClick={() => setTab('users')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: tab === 'users' ? '2px solid var(--sys-primary)' : '2px solid transparent',
                color: tab === 'users' ? 'var(--sys-primary)' : 'var(--sys-text-muted)',
                fontFamily: 'var(--sys-font-mono)',
              }}
            >
              Users
            </button>
            <button
              onClick={() => setTab('spits')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: tab === 'spits' ? '2px solid var(--sys-primary)' : '2px solid transparent',
                color: tab === 'spits' ? 'var(--sys-primary)' : 'var(--sys-text-muted)',
                fontFamily: 'var(--sys-font-mono)',
              }}
            >
              Spits
            </button>
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
        tab === 'users' ? (
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
        // Discover feed
        <div>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--sys-border)' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--sys-font-display)', color: 'var(--sys-primary)' }}>
              Discover
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--sys-text-muted)', marginTop: '0.25rem' }}>
              Spits from people you don&apos;t follow
            </p>
          </div>
          {isLoadingDiscover ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="loading-spinner"></div>
            </div>
          ) : discoverSpits.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--sys-text-muted)' }}>No new spits to discover</p>
            </div>
          ) : (
            discoverSpits.map((spit) => (
              <Spit key={spit.id} spit={spit} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
