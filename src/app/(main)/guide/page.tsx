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
  { id: 'xp-levels', label: 'XP & Levels' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'quote-respits', label: 'Quote Respits' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'kill-feed', label: 'Kill Feed' },
  { id: 'sound-effects', label: 'Sound Effects' },
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
              <span className="guide-table-label">💬 Quote Respit</span>
              <span className="guide-table-value">Share with your own comment (1 credit)</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">🔖 Bookmark</span>
              <span className="guide-table-value">Save for later (free)</span>
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

          <h3 className="guide-subheading">Costs & XP</h3>
          <div className="guide-table">
            <div className="guide-table-row guide-table-header">
              <span className="guide-table-label">Action</span>
              <span className="guide-table-value">Cost → XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Post a spit</span>
              <span className="guide-table-value">1 credit → +10 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Reply</span>
              <span className="guide-table-value">1 credit → +5 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Respit</span>
              <span className="guide-table-value">1 credit → +3 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Like</span>
              <span className="guide-table-value">1 credit → +2 XP (rewards author +1 credit &amp; +5 HP)</span>
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
              <span className="guide-table-label">Buy treasure chest</span>
              <span className="guide-table-value">100 credits</span>
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
            <li><strong>Purchase</strong> — Buy credit packages on the <Link href="/shop" className="guide-link">Shop</Link> page</li>
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

          <h3 className="guide-subheading">Buy Spits</h3>
          <p>
            Need more spits? Buy credit packages directly in the <Link href="/shop" className="guide-link">Shop</Link> via
            Stripe. Packages range from 100 to 5,000 spits. Spits never expire.
          </p>

          <h3 className="guide-subheading">Transaction History</h3>
          <p>
            Scroll to the bottom of the <Link href="/shop" className="guide-link">Shop</Link> to see your
            recent transaction history — every purchase, post, like, transfer, and conversion is logged.
          </p>

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
          <p>Treasure chests contain random loot. You can earn one free daily or buy them in the Shop.</p>

          <h3 className="guide-subheading">Getting Chests</h3>
          <ul className="guide-list">
            <li><strong>Daily free chest</strong> — A popup appears when you log in after 24 hours</li>
            <li><strong>Buy in Shop</strong> — Purchase additional chests for 100 spits each</li>
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

          <h3 className="guide-subheading">Daily Limits</h3>
          <div className="guide-table">
            <div className="guide-table-row">
              <span className="guide-table-label">Send limit</span>
              <span className="guide-table-value">100 spits per 24 hours</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Receive limit</span>
              <span className="guide-table-value">100 spits per 24 hours</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Over-limit penalty</span>
              <span className="guide-table-value">-100 HP per spit over the limit</span>
            </div>
          </div>

          <h3 className="guide-subheading">Rules</h3>
          <ul className="guide-list">
            <li>Transfers are instant and cannot be reversed</li>
            <li>The minimum transfer amount is 1 spit</li>
            <li>You cannot send more spits than your current balance</li>
            <li>The recipient receives a notification about the transfer</li>
            <li>Exceeding the daily limit is allowed but costs <strong>100 HP per spit</strong> over the limit</li>
            <li>You will see a warning before confirming an over-limit transfer</li>
          </ul>

          <div className="guide-callout guide-callout-warning">
            <span className="guide-callout-icon">&#x2620;&#xFE0F;</span>
            <div>
              <strong>Warning:</strong> The HP penalty for exceeding daily limits is severe.
              Sending 10 spits over the limit costs 1,000 HP. Abuse will get your account destroyed!
            </div>
          </div>
        </section>

        {/* XP & Levels */}
        <section id="xp-levels" className="guide-section">
          <h2 className="guide-heading">XP & Levels</h2>
          <p>
            Every interaction on SPITr earns you XP (Experience Points). Accumulate enough XP
            and you&apos;ll level up. Higher levels are harder to reach — grind to prove your worth.
          </p>

          <h3 className="guide-subheading">XP Rewards</h3>
          <div className="guide-table">
            <div className="guide-table-row guide-table-header">
              <span className="guide-table-label">Action</span>
              <span className="guide-table-value">XP Earned</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Post a spit</span>
              <span className="guide-table-value">+10 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Reply</span>
              <span className="guide-table-value">+5 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Respit</span>
              <span className="guide-table-value">+3 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Like</span>
              <span className="guide-table-value">+2 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Attack</span>
              <span className="guide-table-value">+8 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Transfer spits</span>
              <span className="guide-table-value">+3 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Open chest</span>
              <span className="guide-table-value">+15 XP</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Use potion</span>
              <span className="guide-table-value">+2 XP</span>
            </div>
          </div>

          <h3 className="guide-subheading">Leveling Up</h3>
          <p>
            Each level requires more XP than the last. Level 2 needs 100 XP, Level 3 needs 300 XP,
            and it keeps growing. Your level badge and XP bar appear on your profile.
          </p>

          <h3 className="guide-subheading">Level Badge Colors</h3>
          <div className="guide-table">
            <div className="guide-table-row">
              <span className="guide-table-label" style={{ color: '#888' }}>Lv. 1-5</span>
              <span className="guide-table-value">Gray — Newcomer</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label" style={{ color: '#22c55e' }}>Lv. 6-10</span>
              <span className="guide-table-value">Green — Regular</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label" style={{ color: '#3b82f6' }}>Lv. 11-20</span>
              <span className="guide-table-value">Blue — Veteran</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label" style={{ color: '#a855f7' }}>Lv. 21-50</span>
              <span className="guide-table-value">Purple — Elite</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label" style={{ color: '#f59e0b' }}>Lv. 51+</span>
              <span className="guide-table-value">Gold — Legendary</span>
            </div>
          </div>

          <div className="guide-callout">
            <span className="guide-callout-icon">💡</span>
            <div>
              <strong>Tip:</strong> The more you use the app, the faster you level up.
              Post, like, attack, and open chests to maximize your XP gain.
            </div>
          </div>
        </section>

        {/* Bookmarks */}
        <section id="bookmarks" className="guide-section">
          <h2 className="guide-heading">Bookmarks</h2>
          <p>
            Save spits for later by bookmarking them. Bookmarked spits appear on your
            personal <Link href="/bookmarks" className="guide-link">Bookmarks</Link> page.
          </p>
          <ul className="guide-list">
            <li>Click the bookmark icon on any spit to save it</li>
            <li>Click again to remove the bookmark</li>
            <li>Bookmarks are private — only you can see them</li>
            <li>Access your bookmarks from the sidebar navigation</li>
          </ul>
        </section>

        {/* Quote Respits */}
        <section id="quote-respits" className="guide-section">
          <h2 className="guide-heading">Quote Respits</h2>
          <p>
            Want to share someone&apos;s spit with your own commentary? Use a Quote Respit.
          </p>

          <h3 className="guide-subheading">How to Quote Respit</h3>
          <div className="guide-steps">
            <div className="guide-step">
              <span className="guide-step-num">1</span>
              <div>
                <strong>Click the respit button</strong>
                <p>A dropdown menu appears with two options.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-step-num">2</span>
              <div>
                <strong>Select &quot;Quote Respit&quot;</strong>
                <p>The spit composer opens with the original spit embedded below.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-step-num">3</span>
              <div>
                <strong>Add your comment</strong>
                <p>Write your take on the spit and post it. Costs 1 spit credit.</p>
              </div>
            </div>
          </div>

          <div className="guide-callout">
            <span className="guide-callout-icon">💡</span>
            <div>
              <strong>Tip:</strong> Quote Respits are great for adding context, reactions,
              or starting discussions around someone else&apos;s spit.
            </div>
          </div>
        </section>

        {/* Leaderboard */}
        <section id="leaderboard" className="guide-section">
          <h2 className="guide-heading">Leaderboard</h2>
          <p>
            See who&apos;s dominating SPITr on the <Link href="/search" className="guide-link">Explore</Link> page&apos;s
            Leaderboard tab.
          </p>

          <h3 className="guide-subheading">Categories</h3>
          <div className="guide-table">
            <div className="guide-table-row">
              <span className="guide-table-label">⚔️ Most Kills</span>
              <span className="guide-table-value">Users with the most attacks (destroying spits & profiles)</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">🏆 Highest Level</span>
              <span className="guide-table-value">Users with the most XP and highest levels</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">💰 Richest</span>
              <span className="guide-table-value">Users with the most spit credits</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">❤️ Most Liked</span>
              <span className="guide-table-value">Users whose spits have the most total likes</span>
            </div>
          </div>
          <p style={{ marginTop: '0.75rem', color: 'var(--sys-text-muted)', fontSize: '0.9rem' }}>
            Top 25 users are shown per category. Compete to climb the ranks!
          </p>
        </section>

        {/* Kill Feed */}
        <section id="kill-feed" className="guide-section">
          <h2 className="guide-heading">Kill Feed</h2>
          <p>
            The Kill Feed shows a live log of recent attacks across SPITr.
            Find it on the <Link href="/search" className="guide-link">Explore</Link> page&apos;s Kill Feed tab.
          </p>
          <ul className="guide-list">
            <li>See who attacked whom, with what weapon, and how much damage was dealt</li>
            <li>The feed auto-refreshes every 30 seconds</li>
            <li>Shows the 50 most recent attacks</li>
            <li>Great for tracking rivalries and finding targets</li>
          </ul>
        </section>

        {/* Sound Effects */}
        <section id="sound-effects" className="guide-section">
          <h2 className="guide-heading">Sound Effects</h2>
          <p>
            SPITr has sound effects for various actions to enhance the experience.
          </p>

          <h3 className="guide-subheading">Sounds</h3>
          <div className="guide-table">
            <div className="guide-table-row">
              <span className="guide-table-label">Likes & Respits</span>
              <span className="guide-table-value">Quick spit sound</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Knife attack</span>
              <span className="guide-table-value">Knife slash</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Gun / Soldier attack</span>
              <span className="guide-table-value">Gunshot</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Drone attack</span>
              <span className="guide-table-value">Drone buzz</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Open chest</span>
              <span className="guide-table-value">Chest opening</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Use potion</span>
              <span className="guide-table-value">Potion gulp</span>
            </div>
            <div className="guide-table-row">
              <span className="guide-table-label">Gold / Transfers</span>
              <span className="guide-table-value">Gold coin clink</span>
            </div>
          </div>

          <p style={{ marginTop: '0.75rem' }}>
            Toggle sound effects on or off in <Link href="/settings" className="guide-link">Settings</Link> under
            the Appearance section.
          </p>
        </section>

        {/* Profiles */}
        <section id="profiles" className="guide-section">
          <h2 className="guide-heading">Profiles</h2>
          <p>Your profile is your identity on SPITr.</p>
          <ul className="guide-list">
            <li><strong>Avatar & Banner</strong> — Upload custom images</li>
            <li><strong>Bio</strong> — 160 characters to describe yourself</li>
            <li><strong>Handle</strong> — Your unique @username (can be changed in settings)</li>
            <li><strong>Stats</strong> — Follower/following counts, spit count, HP bar, XP bar, level badge</li>
            <li><strong>Gunshot Wounds</strong> — Bullet holes appear on damaged profiles (1 wound per 500 HP lost)</li>
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
            <li><strong>Sound Effects</strong> — Toggle sound effects on/off</li>
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
            <div className="guide-tip">
              <span className="guide-tip-emoji">📈</span>
              <p>Every action earns XP. Post, like, attack, and open chests to level up fast.</p>
            </div>
            <div className="guide-tip">
              <span className="guide-tip-emoji">🔖</span>
              <p>Bookmark spits you want to come back to. They&apos;re private — only you can see them.</p>
            </div>
            <div className="guide-tip">
              <span className="guide-tip-emoji">💬</span>
              <p>Use Quote Respits to add your own take when sharing someone&apos;s spit.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
