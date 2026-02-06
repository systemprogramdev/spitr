'use client'

import { useState } from 'react'
import Link from 'next/link'

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'spits', label: 'Spits (Posts)' },
  { id: 'credits', label: 'Credit Economy' },
  { id: 'gold-shop', label: 'Gold & Shop' },
  { id: 'combat', label: 'Combat System' },
  { id: 'chests', label: 'Treasure Chests' },
  { id: 'like-rewards', label: 'Like Rewards' },
  { id: 'transfers', label: 'Sending Spits' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'messages', label: 'Messages' },
  { id: 'promoted', label: 'Promoted Spits' },
  { id: 'settings', label: 'Settings' },
  { id: 'tips', label: 'Tips & Tricks' },
]

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('overview')

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span style={{ marginRight: '0.5rem' }}>📖</span>
          Guide
        </h1>
      </header>

      {/* Table of Contents */}
      <div className="guide-toc">
        {sections.map((s) => (
          <button
            key={s.id}
            className={`guide-toc-item ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => scrollToSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="guide-content">
        {/* Overview */}
        <section id="overview" className="guide-section">
          <h2 className="guide-heading">Welcome to SPITr</h2>
          <p>
            SPITr is a cyberpunk-themed social platform where every action has a cost.
            Post &quot;spits&quot; (short messages), battle other users, collect loot, and
            build your reputation — all powered by a dual-currency economy.
          </p>
          <div className="guide-callout">
            <span className="guide-callout-icon">💡</span>
            <div>
              <strong>New here?</strong> You start with <strong>1,000 free spits</strong> (credits).
              Every post, reply, and respit costs 1 spit — so spend wisely!
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section id="getting-started" className="guide-section">
          <h2 className="guide-heading">Getting Started</h2>
          <div className="guide-steps">
            <div className="guide-step">
              <span className="guide-step-num">1</span>
              <div>
                <strong>Create your account</strong>
                <p>Sign up with your email. Choose a display name and a unique @handle.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-step-num">2</span>
              <div>
                <strong>Post your first spit</strong>
                <p>
                  Hit the <strong>New Spit</strong> button (or the + icon on mobile).
                  Write up to 280 characters. Costs 1 spit credit.
                </p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-step-num">3</span>
              <div>
                <strong>Follow people</strong>
                <p>
                  Find users via <Link href="/search" className="guide-link">Explore</Link> or
                  the &quot;Who to Follow&quot; panel. Following is free!
                </p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-step-num">4</span>
              <div>
                <strong>Customize your profile</strong>
                <p>
                  Go to <Link href="/settings/profile" className="guide-link">Settings &gt; Profile</Link> to
                  add an avatar, banner, bio, and more.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Spits */}
        <section id="spits" className="guide-section">
          <h2 className="guide-heading">Spits (Posts)</h2>
          <p>Spits are short messages up to 280 characters. Think tweets, but with teeth.</p>

          <h3 className="guide-subheading">Actions</h3>
          <div className="guide-table">
            <div className="guide-table-row">
              <span className="guide-table-label">💬 Reply</span>
              <span className="guide-table-value">Respond to a spit (1 credit)</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">🔄 Respit</span>
              <span className="guide-table-value">Share to your followers (1 credit)</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">❤️ Like</span>
              <span className="guide-table-value">Show appreciation (1 credit) — gives +5 HP and +1 credit to author</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">🔗 Share</span>
              <span className="guide-table-value">Copy link to clipboard (free)</span>
            </div>
          </div>

          <h3 className="guide-subheading">Extras</h3>
          <ul className="guide-list">
            <li><strong>Images</strong> — Attach a photo to your spit (+50 credits)</li>
            <li><strong>Visual Effects</strong> — Add glitch, neon, matrix, and other effects (+1 credit)</li>
            <li><strong>@Mentions</strong> — Tag other users with @handle. They get notified</li>
            <li><strong>Links</strong> — URLs are auto-detected and show link previews</li>
          </ul>
        </section>

        {/* Credits */}
        <section id="credits" className="guide-section">
          <h2 className="guide-heading">Credit Economy</h2>
          <p>
            &quot;Spits&quot; are your credits — the currency that powers everything.
            You need them to post, reply, respit, and more.
          </p>

          <h3 className="guide-subheading">Costs</h3>
          <div className="guide-table">
            <div className="guide-table-row">
              <span className="guide-table-label">Post a spit</span>
              <span className="guide-table-value">1 credit</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Reply</span>
              <span className="guide-table-value">1 credit</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Respit</span>
              <span className="guide-table-value">1 credit</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Like</span>
              <span className="guide-table-value">1 credit (rewards author +1 credit &amp; +5 HP)</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Add visual effect</span>
              <span className="guide-table-value">+1 credit</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Add image</span>
              <span className="guide-table-value">+50 credits</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Promote spit</span>
              <span className="guide-table-value">500 credits</span>
            </div>
          </div>

          <h3 className="guide-subheading">Free Actions</h3>
          <p>Follows and direct messages are always free.</p>

          <h3 className="guide-subheading">Earning Credits</h3>
          <ul className="guide-list">
            <li><strong>Signup bonus</strong> — 1,000 free credits</li>
            <li><strong>Monthly renewal</strong> — 1,000 credits every 30 days (automatic)</li>
            <li><strong>Daily chest</strong> — Open every 24 hours for random rewards</li>
            <li><strong>Like rewards</strong> — Earn 1 credit each time someone likes your spit</li>
            <li><strong>Transfers</strong> — Receive spits from other users</li>
            <li><strong>Purchase</strong> — Buy credit packages on the <Link href="/credits" className="guide-link">Credits</Link> page</li>
          </ul>
        </section>

        {/* Gold & Shop */}
        <section id="gold-shop" className="guide-section">
          <h2 className="guide-heading">Gold & Shop</h2>
          <p>
            Gold is the premium currency used to buy weapons, potions, and items in
            the <Link href="/shop" className="guide-link">Shop</Link>.
          </p>

          <h3 className="guide-subheading">Getting Gold</h3>
          <ul className="guide-list">
            <li><strong>Convert spits</strong> — 10 spits = 1 gold (in Shop)</li>
            <li><strong>Buy with Stripe</strong> — Purchase gold packages directly</li>
            <li><strong>Daily chests</strong> — Can contain gold rewards</li>
          </ul>

          <h3 className="guide-subheading">Items</h3>
          <div className="guide-table">
            <div className="guide-table-row guide-table-header">
              <span className="guide-table-label">Item</span>
              <span className="guide-table-value">Cost / Effect</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">🔪 Knife</span>
              <span className="guide-table-value">1g — 5 damage</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">🔫 Gun</span>
              <span className="guide-table-value">5g — 25 damage</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">💂 Soldier</span>
              <span className="guide-table-value">25g — 100 damage</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">🛩️ Drone</span>
              <span className="guide-table-value">100g — 500 damage</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">🧪 Small Potion</span>
              <span className="guide-table-value">10g — Heal 500 HP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">⚗️ Medium Potion</span>
              <span className="guide-table-value">25g — Heal 1,500 HP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">🏺 Large Potion</span>
              <span className="guide-table-value">75g — Full heal (5,000 HP)</span>
            </div>
          </div>
        </section>

        {/* Combat */}
        <section id="combat" className="guide-section">
          <h2 className="guide-heading">Combat System</h2>
          <p>
            Every user and every spit has HP (Health Points). Users start with 5,000 HP.
            Spits have 10 HP. When HP hits 0, you&apos;re &quot;destroyed.&quot;
          </p>

          <h3 className="guide-subheading">How to Attack</h3>
          <ul className="guide-list">
            <li>Click the crosshair icon (⊕) on any spit or profile that isn&apos;t yours</li>
            <li>Select a weapon from your inventory</li>
            <li>Confirm the attack — damage is dealt instantly</li>
            <li>The target gets a notification</li>
          </ul>

          <h3 className="guide-subheading">What Happens at 0 HP?</h3>
          <ul className="guide-list">
            <li><strong>Destroyed spits</strong> — Appear faded with scanlines. Can&apos;t be interacted with</li>
            <li><strong>Destroyed users</strong> — Redirected to a &quot;destroyed&quot; screen. Use potions to heal!</li>
          </ul>

          <div className="guide-callout guide-callout-warning">
            <span className="guide-callout-icon">⚔️</span>
            <div>
              <strong>Pro tip:</strong> Stock up on potions before you get into fights.
              Once you&apos;re destroyed, you can still use potions from the Shop to recover.
            </div>
          </div>
        </section>

        {/* Treasure Chests */}
        <section id="chests" className="guide-section">
          <h2 className="guide-heading">Treasure Chests</h2>
          <p>Every 24 hours you earn a free treasure chest containing random loot.</p>

          <h3 className="guide-subheading">How It Works</h3>
          <ul className="guide-list">
            <li>A popup appears when you log in after 24 hours</li>
            <li>Choose <strong>Claim & Open</strong> to see your loot immediately</li>
            <li>Or <strong>Save for Later</strong> — unopened chests appear in the Shop</li>
            <li>Each chest contains 2-3 random rewards</li>
          </ul>

          <h3 className="guide-subheading">Loot Rarities</h3>
          <div className="guide-table">
            <div className="guide-table-row">
              <span className="guide-table-label" style={{ color: '#ffffff' }}>Common (70%)</span>
              <span className="guide-table-value">5-15 credits, 1-3 gold, or a knife</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label" style={{ color: '#22c55e' }}>Uncommon (22%)</span>
              <span className="guide-table-value">20-50 credits, 3-8 gold, or a small potion</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label" style={{ color: '#3b82f6' }}>Rare (7%)</span>
              <span className="guide-table-value">50-100 credits, 8-15 gold, gun, or medium potion</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label" style={{ color: '#a855f7' }}>Epic (1%)</span>
              <span className="guide-table-value">100-200 credits, 15-30 gold, soldier, drone, or large potion</span>
            </div>
          </div>
        </section>

        {/* Like Rewards */}
        <section id="like-rewards" className="guide-section">
          <h2 className="guide-heading">Like Rewards</h2>
          <p>
            Liking spits is more than just showing appreciation — it actively
            supports the author!
          </p>

          <h3 className="guide-subheading">How It Works</h3>
          <div className="guide-table">
            <div className="guide-table-row">
              <span className="guide-table-label">+5 HP to spit</span>
              <span className="guide-table-value">Each unique like adds 5 HP to the spit (up to 100 HP max)</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">+1 Credit to author</span>
              <span className="guide-table-value">The spit&apos;s author earns 1 free spit credit</span>
            </div>
          </div>

          <h3 className="guide-subheading">Anti-Gaming Rules</h3>
          <ul className="guide-list">
            <li>You cannot earn rewards by liking your own spits</li>
            <li>Each like only rewards once — unliking and re-liking does NOT give additional rewards</li>
            <li>The author gets a notification when they earn a like reward</li>
          </ul>

          <div className="guide-callout">
            <span className="guide-callout-icon">💡</span>
            <div>
              <strong>Tip:</strong> The more people like your spits, the harder they become
              to destroy in combat — and you earn credits passively!
            </div>
          </div>
        </section>

        {/* Sending Spits */}
        <section id="transfers" className="guide-section">
          <h2 className="guide-heading">Sending Spits</h2>
          <p>
            You can send spit credits to other users directly from their profile.
          </p>

          <h3 className="guide-subheading">How to Send</h3>
          <div className="guide-steps">
            <div className="guide-step">
              <span className="guide-step-num">1</span>
              <div>
                <strong>Visit a user&apos;s profile</strong>
                <p>Navigate to any user&apos;s profile page.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-step-num">2</span>
              <div>
                <strong>Click the send button</strong>
                <p>Click the money emoji button next to the message and follow buttons.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-step-num">3</span>
              <div>
                <strong>Enter an amount</strong>
                <p>Enter the number of spits you want to send and confirm.</p>
              </div>
            </div>
          </div>

          <h3 className="guide-subheading">Rules</h3>
          <ul className="guide-list">
            <li>Transfers are instant and cannot be reversed</li>
            <li>The minimum transfer amount is 1 spit</li>
            <li>You cannot send more spits than your current balance</li>
            <li>The recipient receives a notification about the transfer</li>
          </ul>
        </section>

        {/* Profiles */}
        <section id="profiles" className="guide-section">
          <h2 className="guide-heading">Profiles</h2>
          <p>Your profile is your identity on SPITr.</p>
          <ul className="guide-list">
            <li><strong>Avatar & Banner</strong> — Upload custom images</li>
            <li><strong>Bio</strong> — 160 characters to describe yourself</li>
            <li><strong>Handle</strong> — Your unique @username (can be changed in settings)</li>
            <li><strong>Stats</strong> — Follower/following counts, spit count, HP bar</li>
          </ul>
        </section>

        {/* Messages */}
        <section id="messages" className="guide-section">
          <h2 className="guide-heading">Direct Messages</h2>
          <p>Send private messages to any user. Messages are free and update in real time.</p>
          <ul className="guide-list">
            <li>Go to <Link href="/messages" className="guide-link">Messages</Link> to see your conversations</li>
            <li>Start a new conversation from any user&apos;s profile (message icon)</li>
            <li>Unread message counts appear as badges in the nav</li>
          </ul>
        </section>

        {/* Promoted Spits */}
        <section id="promoted" className="guide-section">
          <h2 className="guide-heading">Promoted Spits</h2>
          <p>
            Want your spit seen by everyone? Promote it for 500 credits.
          </p>
          <ul className="guide-list">
            <li>Click the lightning bolt icon (⚡) on your own spit</li>
            <li>Your spit appears at the top of everyone&apos;s feed</li>
            <li>Each user sees it for 60 seconds, then it cycles away</li>
            <li>Promotion lasts 24 hours. Only one active promotion per user</li>
          </ul>
        </section>

        {/* Settings */}
        <section id="settings" className="guide-section">
          <h2 className="guide-heading">Settings</h2>
          <ul className="guide-list">
            <li><strong>Profile</strong> — Edit name, handle, bio, avatar, banner</li>
            <li><strong>Theme</strong> — Choose from Terminal, Neon, Hologram, Amber, Military</li>
            <li><strong>Scanlines</strong> — Toggle the retro CRT scanline effect</li>
            <li><strong>Account</strong> — Manage your account</li>
          </ul>
        </section>

        {/* Tips */}
        <section id="tips" className="guide-section">
          <h2 className="guide-heading">Tips & Tricks</h2>
          <div className="guide-tips">
            <div className="guide-tip">
              <span className="guide-tip-emoji">🎯</span>
              <p>Destroy someone&apos;s spit with a single knife — they only have 10 HP!</p>
            </div>
            <div className="guide-tip">
              <span className="guide-tip-emoji">💰</span>
              <p>Convert spare spits to gold in the Shop to stock up on weapons.</p>
            </div>
            <div className="guide-tip">
              <span className="guide-tip-emoji">🛡️</span>
              <p>Keep a Large Potion in your inventory as insurance against attacks.</p>
            </div>
            <div className="guide-tip">
              <span className="guide-tip-emoji">📦</span>
              <p>Save your daily chests for when you need supplies — they don&apos;t expire!</p>
            </div>
            <div className="guide-tip">
              <span className="guide-tip-emoji">⚡</span>
              <p>Promote your best spit to gain followers fast. 500 credits well spent.</p>
            </div>
            <div className="guide-tip">
              <span className="guide-tip-emoji">❤️</span>
              <p>Like other people&apos;s spits — you make their spit harder to kill and earn them free credits.</p>
            </div>
            <div className="guide-tip">
              <span className="guide-tip-emoji">💸</span>
              <p>Send spits to friends who are running low. Visit their profile and hit the send button.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
