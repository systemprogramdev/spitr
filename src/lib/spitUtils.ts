import { createClient } from '@/lib/supabase/client'
import { SpitWithAuthor } from '@/types'

const supabase = createClient()

interface RawSpit {
  id: string
  user_id: string
  content: string
  image_url: string | null
  reply_to_id: string | null
  effect: string | null
  hp: number
  created_at: string
  author: {
    id: string
    handle: string
    name: string
    bio: string | null
    avatar_url: string | null
    banner_url: string | null
    location: string | null
    website: string | null
    hp: number
    is_destroyed: boolean
    last_chest_claimed_at: string | null
    created_at: string
    updated_at: string
  }
}

export async function enrichSpitsWithCounts(
  rawSpits: RawSpit[],
  currentUserId?: string
): Promise<SpitWithAuthor[]> {
  if (!rawSpits || rawSpits.length === 0) {
    return []
  }

  const spitIds = rawSpits.map(s => s.id).filter(Boolean)

  if (spitIds.length === 0) {
    return rawSpits.map(spit => ({
      ...spit,
      author: spit.author,
      effect: spit.effect,
      like_count: 0,
      respit_count: 0,
      reply_count: 0,
      is_liked: false,
      is_respit: false,
    }))
  }

  // Fetch counts in parallel
  const [likeCounts, respitCounts, replyCounts, userLikes, userRespits] = await Promise.all([
    // Like counts
    supabase
      .from('likes')
      .select('spit_id')
      .in('spit_id', spitIds),
    // Respit counts
    supabase
      .from('respits')
      .select('spit_id')
      .in('spit_id', spitIds),
    // Reply counts - count spits where reply_to_id matches our spit ids
    supabase
      .from('spits')
      .select('reply_to_id')
      .in('reply_to_id', spitIds)
      .not('reply_to_id', 'is', null),
    // User's likes (if logged in)
    currentUserId
      ? supabase
          .from('likes')
          .select('spit_id')
          .eq('user_id', currentUserId)
          .in('spit_id', spitIds)
      : Promise.resolve({ data: [] }),
    // User's respits (if logged in)
    currentUserId
      ? supabase
          .from('respits')
          .select('spit_id')
          .eq('user_id', currentUserId)
          .in('spit_id', spitIds)
      : Promise.resolve({ data: [] }),
  ])

  // Debug logging
  if (replyCounts.error) {
    console.error('Error fetching reply counts:', replyCounts.error)
  }

  // Count occurrences
  const likeCountMap: Record<string, number> = {}
  const respitCountMap: Record<string, number> = {}
  const replyCountMap: Record<string, number> = {}
  const userLikedSet = new Set((userLikes.data || []).map(l => l.spit_id))
  const userRespitSet = new Set((userRespits.data || []).map(r => r.spit_id))

  ;(likeCounts.data || []).forEach(l => {
    likeCountMap[l.spit_id] = (likeCountMap[l.spit_id] || 0) + 1
  })
  ;(respitCounts.data || []).forEach(r => {
    respitCountMap[r.spit_id] = (respitCountMap[r.spit_id] || 0) + 1
  })
  ;(replyCounts.data || []).forEach(r => {
    if (r.reply_to_id) {
      replyCountMap[r.reply_to_id] = (replyCountMap[r.reply_to_id] || 0) + 1
    }
  })

  return rawSpits.map((spit) => ({
    ...spit,
    author: spit.author,
    effect: spit.effect,
    like_count: likeCountMap[spit.id] || 0,
    respit_count: respitCountMap[spit.id] || 0,
    reply_count: replyCountMap[spit.id] || 0,
    is_liked: userLikedSet.has(spit.id),
    is_respit: userRespitSet.has(spit.id),
  }))
}
