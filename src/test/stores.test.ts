import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/authStore'
import { useCreditsStore } from '@/stores/creditsStore'
import { useUIStore } from '@/stores/uiStore'

describe('Auth Store', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: false })
  })

  it('should start with null user', () => {
    const { user } = useAuthStore.getState()
    expect(user).toBeNull()
  })

  it('should set user', () => {
    const mockUser = {
      id: '123',
      handle: 'testuser',
      name: 'Test User',
      bio: null,
      avatar_url: null,
      banner_url: null,
      location: null,
      website: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    useAuthStore.getState().setUser(mockUser)

    const { user } = useAuthStore.getState()
    expect(user).toEqual(mockUser)
    expect(user?.handle).toBe('testuser')
  })

  it('should clear user on logout', () => {
    useAuthStore.getState().setUser({
      id: '123',
      handle: 'test',
      name: 'Test',
      bio: null,
      avatar_url: null,
      banner_url: null,
      location: null,
      website: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    useAuthStore.getState().setUser(null)

    const { user } = useAuthStore.getState()
    expect(user).toBeNull()
  })
})

describe('Credits Store', () => {
  beforeEach(() => {
    useCreditsStore.setState({ balance: 0 })
  })

  it('should start with 0 balance', () => {
    const { balance } = useCreditsStore.getState()
    expect(balance).toBe(0)
  })

  it('should set balance', () => {
    useCreditsStore.getState().setBalance(1000)

    const { balance } = useCreditsStore.getState()
    expect(balance).toBe(1000)
  })

  it('should deduct credits', () => {
    useCreditsStore.getState().setBalance(100)
    useCreditsStore.getState().deduct(1)

    const { balance } = useCreditsStore.getState()
    expect(balance).toBe(99)
  })

  it('should deduct custom amount', () => {
    useCreditsStore.getState().setBalance(100)
    useCreditsStore.getState().deduct(50)

    const { balance } = useCreditsStore.getState()
    expect(balance).toBe(50)
  })
})

describe('UI Store', () => {
  beforeEach(() => {
    useUIStore.setState({ theme: 'terminal', scanlines: true })
  })

  it('should have terminal theme by default', () => {
    const { theme } = useUIStore.getState()
    expect(theme).toBe('terminal')
  })

  it('should change theme', () => {
    useUIStore.getState().setTheme('neon')

    const { theme } = useUIStore.getState()
    expect(theme).toBe('neon')
  })

  it('should toggle scanlines', () => {
    const initialScanlines = useUIStore.getState().scanlines
    useUIStore.getState().toggleScanlines()

    const { scanlines } = useUIStore.getState()
    expect(scanlines).toBe(!initialScanlines)
  })
})
