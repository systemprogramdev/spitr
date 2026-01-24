import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spit } from '@/components/spit'
import { SpitWithAuthor } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useCreditsStore } from '@/stores/creditsStore'

// Mock useCredits hook
vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 100,
    deductCredit: vi.fn().mockResolvedValue(true),
    hasCredits: () => true,
  }),
}))

describe('Spit Component', () => {
  const mockSpit: SpitWithAuthor = {
    id: 'spit-1',
    user_id: 'user-1',
    content: 'Hello, this is a test spit!',
    image_url: null,
    reply_to_id: null,
    created_at: new Date().toISOString(),
    author: {
      id: 'user-1',
      handle: 'testuser',
      name: 'Test User',
      bio: null,
      avatar_url: null,
      banner_url: null,
      location: null,
      website: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    like_count: 5,
    respit_count: 2,
    reply_count: 3,
    is_liked: false,
    is_respit: false,
  }

  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'current-user',
        handle: 'currentuser',
        name: 'Current User',
        bio: null,
        avatar_url: null,
        banner_url: null,
        location: null,
        website: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      isLoading: false,
    })
    useCreditsStore.setState({ balance: 100 })
  })

  it('should render spit content', () => {
    render(<Spit spit={mockSpit} />)

    expect(screen.getByText('Hello, this is a test spit!')).toBeInTheDocument()
  })

  it('should render author name and handle', () => {
    render(<Spit spit={mockSpit} />)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('@testuser')).toBeInTheDocument()
  })

  it('should render like count', () => {
    render(<Spit spit={mockSpit} />)

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('should render respit count', () => {
    render(<Spit spit={mockSpit} />)

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('should render reply count', () => {
    render(<Spit spit={mockSpit} />)

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('should render pinned indicator when spit is pinned', () => {
    const pinnedSpit = { ...mockSpit, is_pinned: true }
    render(<Spit spit={pinnedSpit} />)

    expect(screen.getByText('Pinned')).toBeInTheDocument()
  })

  it('should not render pinned indicator when spit is not pinned', () => {
    render(<Spit spit={mockSpit} />)

    expect(screen.queryByText('Pinned')).not.toBeInTheDocument()
  })

  it('should render image when present', () => {
    const spitWithImage = { ...mockSpit, image_url: 'https://example.com/image.jpg' }
    render(<Spit spit={spitWithImage} />)

    // Image has alt="" making it presentational, so we query by role presentation
    const img = screen.getByRole('presentation')
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg')
  })

  it('should show liked state when is_liked is true', () => {
    const likedSpit = { ...mockSpit, is_liked: true }
    render(<Spit spit={likedSpit} />)

    // The like button should have 'active' class when liked
    const likeButton = screen.getAllByRole('button').find(btn =>
      btn.classList.contains('spit-action-like')
    )
    expect(likeButton).toHaveClass('active')
  })

  it('should link to user profile', () => {
    render(<Spit spit={mockSpit} />)

    const profileLinks = screen.getAllByRole('link').filter(link =>
      link.getAttribute('href') === '/testuser'
    )
    expect(profileLinks.length).toBeGreaterThan(0)
  })

  it('should link to spit detail page', () => {
    render(<Spit spit={mockSpit} />)

    const detailLinks = screen.getAllByRole('link').filter(link =>
      link.getAttribute('href') === '/testuser/status/spit-1'
    )
    expect(detailLinks.length).toBeGreaterThan(0)
  })
})
