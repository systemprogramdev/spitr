'use client'

import { SpitComposer } from '@/components/spit'
import { Feed } from '@/components/feed'
import { useFeed } from '@/hooks/useFeed'

export default function HomePage() {
  const { spits, pinnedSpits, isLoading, hasMore, loadMore, refresh, dismissPin } = useFeed()

  return (
    <div>
      <div style={{ borderBottom: '1px solid var(--sys-border)' }}>
        <SpitComposer onSuccess={refresh} />
      </div>

      <Feed
        spits={spits}
        pinnedSpits={pinnedSpits}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onRefresh={refresh}
        onDismissPin={dismissPin}
      />
    </div>
  )
}
