import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Feed } from '@/components/feed'
import { SpitWithAuthor } from '@/types'

// Mock the Spit component
vi.mock('@/components/spit', () => ({
  Spit: ({ spit }: { spit: SpitWithAuthor }) => (
    <div data-testid="spit">{spit.content}</div>
  ),
}))

describe('Feed Component', () => {
  const mockSpits: SpitWithAuthor[] = [
    {
      id: '1',
      user_id: 'user1',
      content: 'First spit content',
      image_url: null,
      reply_to_id: null,
      effect: null,
      hp: 10,
      created_at: new Date().toISOString(),
      author: {
        id: 'user1',
        handle: 'user1',
        name: 'User One',
        bio: null,
        avatar_url: null,
        banner_url: null,
        location: null,
        website: null,
        hp: 5000,
        is_destroyed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      like_count: 5,
      respit_count: 2,
      reply_count: 1,
      is_liked: false,
      is_respit: false,
    },
    {
      id: '2',
      user_id: 'user2',
      content: 'Second spit content',
      image_url: null,
      reply_to_id: null,
      effect: null,
      hp: 10,
      created_at: new Date().toISOString(),
      author: {
        id: 'user2',
        handle: 'user2',
        name: 'User Two',
        bio: null,
        avatar_url: null,
        banner_url: null,
        location: null,
        website: null,
        hp: 5000,
        is_destroyed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      like_count: 10,
      respit_count: 5,
      reply_count: 3,
      is_liked: true,
      is_respit: false,
    },
  ]

  it('should render loading state', () => {
    render(
      <Feed
        spits={[]}
        isLoading={true}
        hasMore={true}
        onLoadMore={() => {}}
      />
    )

    expect(screen.getByText('Loading feed...')).toBeInTheDocument()
  })

  it('should render empty state when no spits', () => {
    render(
      <Feed
        spits={[]}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
      />
    )

    expect(screen.getByText('No spits yet. Be the first to post!')).toBeInTheDocument()
  })

  it('should render spits', () => {
    render(
      <Feed
        spits={mockSpits}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
      />
    )

    expect(screen.getByText('First spit content')).toBeInTheDocument()
    expect(screen.getByText('Second spit content')).toBeInTheDocument()
  })

  it('should render correct number of spits', () => {
    render(
      <Feed
        spits={mockSpits}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
      />
    )

    const spitElements = screen.getAllByTestId('spit')
    expect(spitElements).toHaveLength(2)
  })

  it('should show end of feed message', () => {
    render(
      <Feed
        spits={mockSpits}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
      />
    )

    expect(screen.getByText('// end of feed')).toBeInTheDocument()
  })
})
