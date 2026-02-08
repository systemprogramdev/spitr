import { createClient } from '@/lib/supabase/client'
import { SpitWithAuthor } from '@/types'

const supabase = createClient()

interface RawSpit {
  id: string
  user_id: string
  content: string
  image_url: string | null
  reply_to_id: string | null
  quote_spit_id?: string | null
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
      quote_spit_id: spit.quote_spit_id ?? null,
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
  const [likeCounts, respitCounts, replyCounts, userLikes, userRespits, userBookmarks] = await Promise.all([
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
    // User's bookmarks (if logged in)
    currentUserId
      ? supabase
          .from('user_bookmarks')
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
  const userBookmarkSet = new Set((userBookmarks.data || []).map(b => b.spit_id))

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

  // Fetch reply-to handles (look up parent spit authors)
  const replyToIds = rawSpits
    .map(s => s.reply_to_id)
    .filter(Boolean) as string[]

  let replyToHandleMap: Record<string, string> = {}
  if (replyToIds.length > 0) {
    const uniqueReplyIds = [...new Set(replyToIds)]
    const { data: parentSpits } = await supabase
      .from('spits')
      .select('id, author:users!spits_user_id_fkey(handle)')
      .in('id', uniqueReplyIds)

    if (parentSpits) {
      for (const ps of parentSpits) {
        const author = ps.author as unknown as { handle: string } | null
        if (author?.handle) {
          replyToHandleMap[ps.id] = author.handle
        }
      }
    }
  }

  // Fetch quoted spits
  const quoteIds = rawSpits
    .map(s => (s as any).quote_spit_id)
    .filter(Boolean) as string[]

  let quotedSpitMap: Record<string, any> = {}
  if (quoteIds.length > 0) {
    const uniqueQuoteIds = [...new Set(quoteIds)]
    const { data: quotedSpits } = await supabase
      .from('spits')
      .select('*, author:users!spits_user_id_fkey(*)')
      .in('id', uniqueQuoteIds)

    if (quotedSpits) {
      quotedSpitMap = Object.fromEntries(quotedSpits.map(s => [s.id, s]))
    }
  }

  return rawSpits.map((spit) => {
    const qid = (spit as any).quote_spit_id
    const quotedRaw = qid ? quotedSpitMap[qid] : null

    return {
      ...spit,
      quote_spit_id: spit.quote_spit_id ?? null,
      author: spit.author,
      effect: spit.effect,
      like_count: likeCountMap[spit.id] || 0,
      respit_count: respitCountMap[spit.id] || 0,
      reply_count: replyCountMap[spit.id] || 0,
      is_liked: userLikedSet.has(spit.id),
      is_respit: userRespitSet.has(spit.id),
      is_bookmarked: userBookmarkSet.has(spit.id),
      reply_to_handle: spit.reply_to_id ? replyToHandleMap[spit.reply_to_id] ?? null : null,
      quoted_spit: quotedRaw ? {
        ...quotedRaw,
        author: quotedRaw.author,
        like_count: 0,
        respit_count: 0,
        reply_count: 0,
        is_liked: false,
        is_respit: false,
      } : null,
    }
  })
}
