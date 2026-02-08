'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { User, SpitWithAuthor } from '@/types'
import { Spit, AttackModal } from '@/components/spit'
import { TransferModal } from '@/components/transfer/TransferModal'
import { GoldTransferModal } from '@/components/transfer/GoldTransferModal'
import { enrichSpitsWithCounts } from '@/lib/spitUtils'
import { HPBar } from '@/components/ui/HPBar'
import { XPBar } from '@/components/ui/XPBar'
import { LevelBadge } from '@/components/ui/LevelBadge'
import { getMaxHp } from '@/lib/items'
import { GunshotWounds } from '@/components/profile/GunshotWounds'
import { SprayPaintOverlay } from '@/components/profile/SprayPaintOverlay'

const supabase = createClient()
const PAGE_SIZE = 20

type TabType = 'spits' | 'replies' | 'likes' | 'respits'

export default function ProfilePage() {
  const params = useParams()
  const handle = params.handle as string
  const { user: currentUser } = useAuthStore()
  const [profile, setProfile] = useState<User | null>(null)
  const [spits, setSpits] = useState<SpitWithAuthor[]>([])
  const [stats, setStats] = useState({ followers: 0, following: 0, spits: 0, credits: 0, gold: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isTabLoading, setIsTabLoading] = useState(false)
  const [tab, setTab] = useState<TabType>('spits')
  const [hasMore, setHasMore] = useState(false)
  const loadingMore = useRef(false)
  const observerRef = useRef<HTMLDivElement>(null)
  const [showFollowModal, setShowFollowModal] = useState<'followers' | 'following' | null>(null)
  const [followList, setFollowList] = useState<User[]>([])
  const [pinnedSpit, setPinnedSpit] = useState<SpitWithAuthor | null>(null)
  const [profileHp, setProfileHp] = useState(getMaxHp(1))
  const [profileDestroyed, setProfileDestroyed] = useState(false)
  const [showAttackModal, setShowAttackModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showGoldTransferModal, setShowGoldTransferModal] = useState(false)
  const [userXp, setUserXp] = useState(0)
  const [userLevel, setUserLevel] = useState(1)
  const [activeBuffs, setActiveBuffs] = useState<{ buff_type: string; charges_remaining: number }[]>([])

  const fetchTabContent = useCallback(async (profileId: string, selectedTab: TabType, cursor?: string) => {
    const isLoadMore = !!cursor
    if (isLoadMore) {
      if (loadingMore.current) return
      loadingMore.current = true
    } else {
      setIsTabLoading(true)
    }
    let data: SpitWithAuthor[] = []
    let fetchedCount = 0

    if (selectedTab === 'spits') {
      // User's original spits AND respits combined, sorted by date
      let spitsQuery = supabase
        .from('spits')
        .select(`*, author:users!spits_user_id_fkey(*)`)
        .eq('user_id', profileId)
        .is('reply_to_id', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      let respitsQuery = supabase
        .from('respits')
        .select(`created_at, spit:spits!respits_spit_id_fkey(*, author:users!spits_user_id_fkey(*))`)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (cursor) {
        spitsQuery = spitsQuery.lt('created_at', cursor)
        respitsQuery = respitsQuery.lt('created_at', cursor)
      }

      const [spitsResult, respitsResult] = await Promise.all([spitsQuery, respitsQuery])

      // Enrich original spits
      const enrichedSpits = await enrichSpitsWithCounts(spitsResult.data || [], currentUser?.id)
      const spitsWithTime = enrichedSpits.map((s) => ({
        ...s,
        _sortTime: new Date(s.created_at).getTime(),
        _isRespit: false,
      }))

      // Enrich respits (these are other people's spits that this user respit)
      const respitSpits = (respitsResult.data || [])
        .filter((r: any) => r.spit)
        .map((r: any) => r.spit)
      const enrichedRespits = await enrichSpitsWithCounts(respitSpits, currentUser?.id)
      const respitsWithTime = enrichedRespits.map((s, i) => ({
        ...s,
        _sortTime: new Date((respitsResult.data as any)[i]?.created_at || s.created_at).getTime(),
        _isRespit: true,
        _respitBy: profile?.handle,
      }))

      // Combine and sort by time descending
      const combined = [...spitsWithTime, ...respitsWithTime]
        .sort((a, b) => b._sortTime - a._sortTime)
        .slice(0, PAGE_SIZE)

      data = combined
      fetchedCount = (spitsResult.data || []).length + (respitsResult.data || []).length
    } else if (selectedTab === 'replies') {
      let query = supabase
        .from('spits')
        .select(`*, author:users!spits_user_id_fkey(*)`)
        .eq('user_id', profileId)
        .not('reply_to_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (cursor) query = query.lt('created_at', cursor)

      const { data: repliesData } = await query
      data = await enrichSpitsWithCounts(repliesData || [], currentUser?.id)
      fetchedCount = (repliesData || []).length
    } else if (selectedTab === 'likes') {
      let query = supabase
        .from('likes')
        .select('spit_id, created_at')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (cursor) query = query.lt('created_at', cursor)

      const { data: likesData } = await query

      if (likesData && likesData.length > 0) {
        const spitIds = likesData.map(l => l.spit_id)
        const { data: spitsData } = await supabase
          .from('spits')
          .select(`*, author:users!spits_user_id_fkey(*)`)
          .in('id', spitIds)

        const spitsMap = new Map((spitsData || []).map(s => [s.id, s]))
        const orderedSpits = spitIds.map(id => spitsMap.get(id)).filter(Boolean)
        data = await enrichSpitsWithCounts(orderedSpits as any[], currentUser?.id)
      }
      fetchedCount = (likesData || []).length
    } else if (selectedTab === 'respits') {
      let query = supabase
        .from('respits')
        .select('spit_id, created_at')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (cursor) query = query.lt('created_at', cursor)

      const { data: respitsData } = await query

      if (respitsData && respitsData.length > 0) {
        const spitIds = respitsData.map(r => r.spit_id)
        const { data: spitsData } = await supabase
          .from('spits')
          .select(`*, author:users!spits_user_id_fkey(*)`)
          .in('id', spitIds)

        const spitsMap = new Map((spitsData || []).map(s => [s.id, s]))
        const orderedSpits = spitIds.map(id => spitsMap.get(id)).filter(Boolean)
        data = await enrichSpitsWithCounts(orderedSpits as any[], currentUser?.id)
      }
      fetchedCount = (respitsData || []).length
    }

    if (isLoadMore) {
      setSpits((prev) => [...prev, ...data])
      loadingMore.current = false
    } else {
      setSpits(data)
      setIsTabLoading(false)
    }
    setHasMore(fetchedCount >= PAGE_SIZE)
  }, [currentUser?.id, profile?.handle])

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .ilike('handle', handle)
        .single()

      if (!profileData) {
        setIsLoading(false)
        return
      }

      setProfile(profileData)
      setProfileHp(profileData.hp ?? getMaxHp(1))
      setProfileDestroyed(profileData.is_destroyed ?? false)

      const [followersRes, followingRes, spitsRes, creditsRes, goldRes, pinnedRes, xpRes, buffsRes] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileData.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileData.id),
        supabase.from('spits').select('*', { count: 'exact', head: true }).eq('user_id', profileData.id).is('reply_to_id', null),
        supabase.from('user_credits').select('balance').eq('user_id', profileData.id).single(),
        supabase.from('user_gold').select('balance').eq('user_id', profileData.id).single(),
        supabase.from('pinned_spits')
          .select('spit:spits!pinned_spits_spit_id_fkey(*, author:users!spits_user_id_fkey(*))')
          .eq('user_id', profileData.id)
          .gt('expires_at', new Date().toISOString())
          .single(),
        supabase.from('user_xp').select('xp, level').eq('user_id', profileData.id).single(),
        supabase.from('user_buffs').select('buff_type, charges_remaining').eq('user_id', profileData.id),
      ])

      if (xpRes.data) {
        setUserXp(xpRes.data.xp)
        setUserLevel(xpRes.data.level)
      }

      setActiveBuffs(buffsRes.data || [])

      setStats({
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
        spits: spitsRes.count || 0,
        credits: creditsRes.data?.balance || 0,
        gold: goldRes.data?.balance || 0,
      })

      // Set pinned spit if exists
      if (pinnedRes.data?.spit) {
        const enrichedPinned = await enrichSpitsWithCounts([pinnedRes.data.spit as any], currentUser?.id)
        if (enrichedPinned[0]) {
          setPinnedSpit({ ...enrichedPinned[0], is_pinned: true })
        }
      } else {
        setPinnedSpit(null)
      }

      if (currentUser && currentUser.id !== profileData.id) {
        const { data: followData } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', profileData.id)
          .single()

        setIsFollowing(!!followData)
      }

      await fetchTabContent(profileData.id, 'spits')
      setIsLoading(false)
    }

    fetchProfile()
  }, [handle, currentUser, fetchTabContent])

  useEffect(() => {
    if (profile) {
      fetchTabContent(profile.id, tab)
    }
  }, [tab, profile, fetchTabContent])

  const loadMoreTab = useCallback(() => {
    if (!profile || !hasMore || loadingMore.current) return
    const lastSpit = spits[spits.length - 1]
    if (!lastSpit) return
    fetchTabContent(profile.id, tab, lastSpit.created_at)
  }, [profile, hasMore, spits, tab, fetchTabContent])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const node = observerRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isTabLoading) {
          loadMoreTab()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isTabLoading, loadMoreTab])

  const handleFollow = async () => {
    if (!currentUser || !profile) return

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', profile.id)

      setIsFollowing(false)
      setStats((s) => ({ ...s, followers: s.followers - 1 }))
    } else {
      await supabase.from('follows').insert({
        follower_id: currentUser.id,
        following_id: profile.id,
      })

      setIsFollowing(true)
      setStats((s) => ({ ...s, followers: s.followers + 1 }))
    }
  }

  const openFollowModal = async (type: 'followers' | 'following') => {
    if (!profile) return

    setShowFollowModal(type)
    setFollowList([])

    if (type === 'followers') {
      const { data } = await supabase
        .from('follows')
        .select('follower:users!follows_follower_id_fkey(*)')
        .eq('following_id', profile.id)
        .limit(100)

      setFollowList((data || []).map((f: any) => f.follower))
    } else {
      const { data } = await supabase
        .from('follows')
        .select('following:users!follows_following_id_fkey(*)')
        .eq('follower_id', profile.id)
        .limit(100)

      setFollowList((data || []).map((f: any) => f.following))
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="panel-bash" style={{ margin: '1rem' }}>
        <div className="panel-bash-header">
          <div className="panel-bash-dots">
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
          </div>
          <span className="panel-bash-title">error</span>
        </div>
        <div className="panel-bash-body" style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: 'var(--sys-danger)' }}>User not found</h2>
          <p style={{ color: 'var(--sys-text-muted)' }}>@{handle} doesn&apos;t exist</p>
        </div>
      </div>
    )
  }

  const isOwnProfile = currentUser?.id === profile.id
  const tabs: { key: TabType; label: string }[] = [
    { key: 'spits', label: 'Spits' },
    { key: 'replies', label: 'Replies' },
    { key: 'likes', label: 'Likes' },
    { key: 'respits', label: 'Respits' },
  ]

  return (
    <div>
      {/* Profile Header with wound overlays */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Banner */}
      <div className="profile-banner" style={{
        height: '150px',
        backgroundColor: 'var(--sys-surface)',
        backgroundImage: profile.banner_url ? `url(${profile.banner_url})` : 'linear-gradient(135deg, var(--sys-surface) 0%, rgba(var(--sys-primary-rgb), 0.2) 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderBottom: '1px solid var(--sys-border)',
      }} />

      {/* Profile Info */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--sys-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div
            className="avatar avatar-glow"
            style={{
              width: '100px',
              height: '100px',
              backgroundColor: 'var(--sys-primary)',
              backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : undefined,
              border: '4px solid var(--sys-bg)',
              marginTop: '-50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!profile.avatar_url && (
              <span style={{ fontSize: '2.5rem', fontFamily: 'var(--sys-font-display)', color: 'var(--sys-bg)' }}>
                {profile.name[0]?.toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isOwnProfile && currentUser && (
              <Link href={`/messages/new?to=${profile.handle}`} className="btn btn-outline">
                <span className="sys-icon sys-icon-mail"></span>
              </Link>
            )}
            {!isOwnProfile && currentUser && (
              <button
                className="btn btn-outline"
                onClick={() => setShowTransferModal(true)}
                title="Send Spits"
              >
                &#x1F4B8;
              </button>
            )}
            {!isOwnProfile && currentUser && (
              <button
                className="btn btn-outline"
                onClick={() => setShowGoldTransferModal(true)}
                title="Send Gold"
                style={{ color: '#f0b232' }}
              >
                &#x1FA99;
              </button>
            )}
            {!isOwnProfile && currentUser && !profileDestroyed && (
              <button
                className="btn"
                style={{ background: 'var(--sys-danger)', color: 'var(--sys-bg)' }}
                onClick={() => setShowAttackModal(true)}
                title="Attack this user"
              >
                ⚔️
              </button>
            )}
            {isOwnProfile ? (
              <Link href="/settings/profile" className="btn btn-outline">
                <span className="sys-icon sys-icon-edit" style={{ marginRight: '0.5rem' }}></span>
                Edit Profile
              </Link>
            ) : (
              <button
                onClick={handleFollow}
                className={`btn ${isFollowing ? 'btn-outline' : 'btn-primary btn-glow'}`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <h1 className="text-glow" style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {profile.name}
            <LevelBadge level={userLevel} />
          </h1>
          <p style={{ color: 'var(--sys-text-muted)' }}>@{profile.handle}</p>

          {profile.bio && <p style={{ marginTop: '0.75rem', color: 'var(--sys-text)', fontFamily: 'var(--sys-font-mono)' }}>{profile.bio}</p>}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
            {profile.location && (
              <span style={{ color: 'var(--sys-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="sys-icon sys-icon-map-pin"></span>
                {profile.location}
              </span>
            )}
            {profile.website && (
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--sys-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <span className="sys-icon sys-icon-link"></span>
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <span style={{ color: 'var(--sys-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span className="sys-icon sys-icon-calendar"></span>
              Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* HP Bar + Active Buffs */}
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <HPBar hp={profileHp} maxHp={getMaxHp(userLevel)} size="md" />
            </div>
            {activeBuffs.map((buff) => (
              <span
                key={buff.buff_type}
                title={buff.buff_type === 'firewall' ? 'Firewall Active' : `Kevlar Active (${buff.charges_remaining} charges)`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--sys-font-mono)',
                  background: buff.buff_type === 'firewall' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  border: `1px solid ${buff.buff_type === 'firewall' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                  borderRadius: '4px',
                  color: buff.buff_type === 'firewall' ? '#3b82f6' : '#22c55e',
                  whiteSpace: 'nowrap',
                }}
              >
                {buff.buff_type === 'firewall' ? '🛡️' : '🦺'}
                {buff.buff_type === 'kevlar' && `×${buff.charges_remaining}`}
              </span>
            ))}
          </div>

          {/* XP Bar */}
          <div style={{ marginTop: '0.5rem' }}>
            <XPBar xp={userXp} level={userLevel} />
          </div>

          {profileDestroyed && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid var(--sys-danger)',
              borderRadius: '8px',
              textAlign: 'center',
              color: 'var(--sys-danger)',
              fontWeight: 'bold',
              fontFamily: 'var(--sys-font-display)',
              letterSpacing: '0.1em',
            }}>
              DESTROYED
            </div>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => openFollowModal('following')}
              className="stat-button"
            >
              <strong>{stats.following}</strong> Following
            </button>
            <button
              onClick={() => openFollowModal('followers')}
              className="stat-button"
            >
              <strong>{stats.followers}</strong> Followers
            </button>
            <span className="stat-button" style={{ cursor: 'default' }}>
              <strong style={{ color: 'var(--sys-primary)' }}>{stats.credits.toLocaleString()}</strong> Spits
            </span>
            <span className="stat-button" style={{ cursor: 'default' }}>
              <strong style={{ color: '#FFD700' }}>{stats.gold.toLocaleString()}</strong> Gold
            </span>
          </div>
        </div>
      </div>

      {/* Gunshot Wounds */}
      {!profileDestroyed && profileHp < getMaxHp(userLevel) && (
        <GunshotWounds hp={profileHp} maxHp={getMaxHp(userLevel)} userId={profile.id} />
      )}
      {/* Spray Paint Overlay */}
      <SprayPaintOverlay targetUserId={profile.id} />
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`profile-tab ${tab === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pinned Spit */}
      {pinnedSpit && tab === 'spits' && (
        <div className="pinned-spit-profile">
          <div style={{
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            color: 'var(--sys-warning)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderBottom: '1px solid var(--sys-border)',
            background: 'rgba(245, 158, 11, 0.05)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span>PROMOTED</span>
          </div>
          <Spit spit={pinnedSpit} />
        </div>
      )}

      {/* Content */}
      {isTabLoading && spits.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
        </div>
      ) : spits.length === 0 && !pinnedSpit ? (
        <div className="empty-state">
          <span className="sys-icon sys-icon-terminal sys-icon-lg"></span>
          <p>No {tab} yet</p>
        </div>
      ) : (
        <div>
          {spits.filter(s => s.id !== pinnedSpit?.id).map((spit) => (
            <Spit key={spit.id} spit={spit} />
          ))}
          <div ref={observerRef} style={{ padding: '1rem', textAlign: 'center' }}>
            {loadingMore.current && <div className="loading-spinner"></div>}
            {!hasMore && spits.length > 0 && (
              <p style={{ color: 'var(--sys-text-muted)', fontFamily: 'var(--sys-font-mono)', fontSize: '0.8rem' }}>
                {'// end of feed'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Attack Modal */}
      {showAttackModal && profile && (
        <AttackModal
          targetType="user"
          targetId={profile.id}
          targetName={profile.name}
          onClose={() => setShowAttackModal(false)}
          onAttackComplete={(result) => {
            setProfileHp(result.newHp)
            if (result.destroyed) setProfileDestroyed(true)
          }}
        />
      )}

      {/* Transfer Modal */}
      {showTransferModal && profile && (
        <TransferModal
          recipientId={profile.id}
          recipientHandle={profile.handle}
          recipientName={profile.name}
          onClose={() => setShowTransferModal(false)}
        />
      )}

      {/* Gold Transfer Modal */}
      {showGoldTransferModal && profile && (
        <GoldTransferModal
          recipientId={profile.id}
          recipientHandle={profile.handle}
          recipientName={profile.name}
          onClose={() => setShowGoldTransferModal(false)}
        />
      )}

      {/* Follow Modal */}
      {showFollowModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowFollowModal(null)}
        >
          <div
            className="panel-bash glow"
            style={{ width: '100%', maxWidth: '400px', margin: '1rem', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-bash-header">
              <div className="panel-bash-dots">
                <span className="panel-bash-dot"></span>
                <span className="panel-bash-dot"></span>
                <span className="panel-bash-dot"></span>
              </div>
              <span className="panel-bash-title">{showFollowModal}</span>
              <button
                onClick={() => setShowFollowModal(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--sys-text-muted)', cursor: 'pointer' }}
              >
                <span className="sys-icon sys-icon-x"></span>
              </button>
            </div>
            <div className="panel-bash-body" style={{ overflow: 'auto', maxHeight: '60vh' }}>
              {followList.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--sys-text-muted)' }}>
                  No {showFollowModal} yet
                </div>
              ) : (
                followList.map((user) => (
                  <Link
                    key={user.id}
                    href={`/${user.handle}`}
                    className="follow-item"
                    onClick={() => setShowFollowModal(null)}
                  >
                    <div
                      className="avatar"
                      style={{
                        width: '48px',
                        height: '48px',
                        backgroundColor: 'var(--sys-primary)',
                        backgroundImage: user.avatar_url ? `url(${user.avatar_url})` : undefined,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {!user.avatar_url && (
                        <span style={{ fontFamily: 'var(--sys-font-display)', color: 'var(--sys-bg)' }}>
                          {user.name[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--sys-text)' }}>{user.name}</div>
                      <div style={{ color: 'var(--sys-text-muted)', fontSize: '0.875rem' }}>@{user.handle}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
