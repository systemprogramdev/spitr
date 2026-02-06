'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCredits } from '@/hooks/useCredits'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications'
import { useGold } from '@/hooks/useGold'
import { useModalStore } from '@/stores/modalStore'
import { SpitModal } from '@/components/spit'
import { ChestClaimModal } from '@/components/chest/ChestClaimModal'
import { ChestOpenModal } from '@/components/chest/ChestOpenModal'
import { useDailyChest } from '@/hooks/useDailyChest'
import { createClient } from '@/lib/supabase/client'
import { User } from '@/types'

const supabase = createClient()

const navItems = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/search', label: 'Explore', icon: 'search' },
  { href: '/notifications', label: 'Alerts', icon: 'bell' },
  { href: '/shop', label: 'Shop', icon: 'shopping-bag' },
  { href: '/credits', label: 'Credits', icon: 'star' },
  { href: '/settings', label: 'Settings', icon: 'lock' },
]

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { balance } = useCredits()
  const unreadMessages = useUnreadMessages()
  const unreadNotifications = useUnreadNotifications()
  const { balance: goldBalance } = useGold()
  const { openSpitModal } = useModalStore()
  const [whoToFollow, setWhoToFollow] = useState<User[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  useDailyChest()

  // Close menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Fetch who to follow (3 newest users, excluding self)
  useEffect(() => {
    const fetchWhoToFollow = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (data) {
        const filtered = data
          .filter((u) => u.id !== user?.id)
          .slice(0, 3)
        setWhoToFollow(filtered)
      }
    }

    fetchWhoToFollow()
  }, [user?.id])

  return (
    <div className="scanlines">
      <div className="app-container">
        {/* Mobile Header */}
        <header className="mobile-header">
          <Link href="/" className="mobile-header-logo">
            <img src="/logo.png" alt="SPITr" className="logo-image" />
          </Link>

          <div className="mobile-header-right">
            <Link href="/credits" className="mobile-header-credits">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>{balance.toLocaleString()}</span>
            </Link>

            <button
              className="mobile-header-menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              {user?.avatar_url ? (
                <div
                  className="mobile-header-avatar"
                  style={{ backgroundImage: `url(${user.avatar_url})` }}
                />
              ) : (
                <div className="mobile-header-avatar">
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </button>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-menu-header">
                <div className="mobile-menu-user">
                  {user?.avatar_url ? (
                    <div
                      className="mobile-menu-avatar"
                      style={{ backgroundImage: `url(${user.avatar_url})` }}
                    />
                  ) : (
                    <div className="mobile-menu-avatar">
                      {user?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="mobile-menu-user-info">
                    <div className="mobile-menu-name">{user?.name}</div>
                    <div className="mobile-menu-handle">@{user?.handle}</div>
                  </div>
                </div>
                <button className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="mobile-menu-credits">
                <div className="mobile-menu-credits-label">Your Spits</div>
                <div className="mobile-menu-credits-amount text-glow">{balance.toLocaleString()}</div>
              </div>

              <nav className="mobile-menu-nav">
                <Link href={`/${user?.handle}`} className="mobile-menu-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>Profile</span>
                </Link>

                <Link href="/messages" className="mobile-menu-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>Messages</span>
                  {unreadMessages > 0 && (
                    <span className="sidebar-badge badge-glow" style={{ marginLeft: 'auto' }}>{unreadMessages}</span>
                  )}
                </Link>

                <Link href="/credits" className="mobile-menu-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <span>Buy Credits</span>
                </Link>

                <Link href="/settings" className="mobile-menu-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  <span>Settings</span>
                </Link>

                <div className="mobile-menu-divider" />

                <button className="mobile-menu-item mobile-menu-signout" onClick={signOut}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  <span>Sign Out</span>
                </button>
              </nav>

            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            {/* Logo */}
            <Link href="/" className="sidebar-logo">
              <img src="/logo.png" alt="SPITr" className="logo-image" />
            </Link>

            {/* Nav Items */}
            <ul className="sidebar-menu">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
                  >
                    <span className={`sys-icon sys-icon-${item.icon}`}></span>
                    <span className="sidebar-item-label">{item.label}</span>
                    {item.href === '/credits' && (
                      <span className="sidebar-badge">{balance.toLocaleString()}</span>
                    )}
                    {item.href === '/notifications' && unreadNotifications > 0 && (
                      <span className="sidebar-badge badge-glow">{unreadNotifications}</span>
                    )}
                    {item.href === '/shop' && (
                      <span className="sidebar-badge sidebar-badge-gold">{goldBalance.toLocaleString()}g</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            {/* New Spit Button */}
            <button
              className="btn btn-primary btn-glow sidebar-spit-btn"
              onClick={() => openSpitModal()}
            >
              <span className="sys-icon sys-icon-terminal"></span>
              <span>New Spit</span>
            </button>

            {/* User Profile Card */}
            {user && (
              <div className="sidebar-profile">
                <Link href={`/${user.handle}`} className="sidebar-profile-card">
                  <div
                    className="sidebar-profile-avatar"
                    style={{
                      backgroundImage: user.avatar_url ? `url(${user.avatar_url})` : undefined,
                    }}
                  >
                    {!user.avatar_url && (
                      <span>{user.name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="sidebar-profile-info">
                    <div className="sidebar-profile-name">{user.name}</div>
                    <div className="sidebar-profile-handle">@{user.handle}</div>
                  </div>
                </Link>

                <button
                  onClick={signOut}
                  className="sidebar-signout"
                  title="Sign Out"
                >
                  <span className="sys-icon sys-icon-log-out"></span>
                </button>
              </div>
            )}

          </nav>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {children}
        </main>

        {/* Right Panel */}
        <aside className="right-panel">
          {/* Credits Panel */}
          <div className="right-panel-card">
            <div className="right-panel-card-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>Your Spits</span>
            </div>
            <div className="right-panel-card-body">
              <div className="credits-amount">{balance.toLocaleString()}</div>
              <div className="credits-sublabel">available to spend</div>
              <Link href="/credits" className="btn btn-primary btn-glow" style={{ width: '100%', marginTop: '1rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Get More
              </Link>
            </div>
          </div>

          {/* Who to Follow Panel */}
          <div className="right-panel-card">
            <div className="right-panel-card-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Who to Follow</span>
            </div>
            <div className="right-panel-card-body" style={{ padding: 0 }}>
              {whoToFollow.length === 0 ? (
                <div className="who-to-follow-empty">
                  <span>No suggestions yet</span>
                </div>
              ) : (
                whoToFollow.map((u) => (
                  <Link key={u.id} href={`/${u.handle}`} className="who-to-follow-item">
                    <div
                      className="who-to-follow-avatar"
                      style={{
                        backgroundImage: u.avatar_url ? `url(${u.avatar_url})` : undefined,
                      }}
                    >
                      {!u.avatar_url && (
                        <span>{u.name[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="who-to-follow-info">
                      <div className="who-to-follow-name">{u.name}</div>
                      <div className="who-to-follow-handle">@{u.handle}</div>
                    </div>
                    <div className="who-to-follow-badge">NEW</div>
                  </Link>
                ))
              )}
              <Link href="/search" className="who-to-follow-more">
                <span>Explore more</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div className="right-panel-links">
            <Link href="/credits">Credits</Link>
            <span>·</span>
            <Link href="/settings">Settings</Link>
            <span>·</span>
            <span className="right-panel-version">v0.1</span>
          </div>

          {/* Footer */}
          <div className="right-panel-footer">
            <span>SPITr 2026</span>
          </div>
        </aside>

        {/* Mobile Bottom Nav */}
        <nav className="mobile-nav">
          <Link href="/" className={pathname === '/' ? 'active' : ''}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill={pathname === '/' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </Link>

          <Link href="/search" className={pathname === '/search' ? 'active' : ''}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </Link>

          <button onClick={() => openSpitModal()} className="mobile-nav-new">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>

          <Link href="/notifications" className={`mobile-nav-item ${pathname === '/notifications' ? 'active' : ''}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill={pathname === '/notifications' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadNotifications > 0 && (
              <span className="mobile-nav-badge">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>
            )}
          </Link>

          <Link href="/shop" className={`mobile-nav-item ${pathname === '/shop' ? 'active' : ''}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill={pathname === '/shop' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </Link>
        </nav>

        {/* Spit Modal */}
        <SpitModal />
        <ChestClaimModal />
        <ChestOpenModal />
      </div>
    </div>
  )
}
