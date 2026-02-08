'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCredits } from '@/hooks/useCredits'
import { useGold } from '@/hooks/useGold'
import { useSound } from '@/hooks/useSound'
import { toast } from '@/stores/toastStore'

interface BotConfig {
  id: string
  bot_id: string
  enabled_actions: string[]
  target_mode: string
  combat_strategy: string
  banking_strategy: string
  auto_heal_threshold: number
  custom_prompt: string | null
}

interface BotUserProfile {
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  name: string | null
}

interface Bot {
  id: string
  owner_id: string
  user_id: string
  name: string
  handle: string
  personality: string
  is_active: boolean
  created_at: string
  bot_configs: BotConfig[]
  users: BotUserProfile | null
}

const PERSONALITIES = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'aggressive', label: 'Aggressive' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'chaotic', label: 'Chaotic' },
  { value: 'intellectual', label: 'Intellectual' },
  { value: 'troll', label: 'Troll' },
]

const COMBAT_STRATEGIES = [
  { value: 'passive', label: 'Passive' },
  { value: 'defensive', label: 'Defensive' },
  { value: 'aggressive', label: 'Aggressive' },
  { value: 'opportunistic', label: 'Opportunistic' },
]

const BANKING_STRATEGIES = [
  { value: 'none', label: 'None' },
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
]

export default function DatacenterPage() {
  const { user } = useAuthStore()
  const { balance: spitBalance, refreshBalance: refreshCredits } = useCredits()
  const { balance: goldBalance, refreshBalance: refreshGold } = useGold()
  const { playSound } = useSound()

  const [botName, setBotName] = useState('')
  const [botHandle, setBotHandle] = useState('')
  const [botPersonality, setBotPersonality] = useState('neutral')
  const [isPurchasing, setIsPurchasing] = useState(false)

  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBot, setExpandedBot] = useState<string | null>(null)
  const [savingConfig, setSavingConfig] = useState<string | null>(null)

  const [editPersonality, setEditPersonality] = useState('')
  const [editCombatStrategy, setEditCombatStrategy] = useState('')
  const [editBankingStrategy, setEditBankingStrategy] = useState('')
  const [editAutoHeal, setEditAutoHeal] = useState(50)
  const [editCustomPrompt, setEditCustomPrompt] = useState('')

  // Profile editing state
  const [editName, setEditName] = useState('')
  const [editHandle, setEditHandle] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const [editBannerUrl, setEditBannerUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [savingProfile, setSavingProfile] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/my-bots')
      const data = await res.json()
      if (data.bots) setBots(data.bots)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBots()
  }, [fetchBots])

  const handlePurchase = async (paymentMethod: 'spits' | 'gold') => {
    if (!user || isPurchasing) return

    if (!botName.trim() || !botHandle.trim()) {
      toast.warning('Name and handle are required')
      return
    }

    const handleRegex = /^[a-z0-9_]{3,20}$/
    if (!handleRegex.test(botHandle)) {
      toast.warning('Handle must be 3-20 chars, lowercase alphanumeric + underscores')
      return
    }

    if (paymentMethod === 'spits' && spitBalance < 1000) {
      toast.warning('Need 1,000 spits to purchase a bot')
      return
    }
    if (paymentMethod === 'gold' && goldBalance < 100) {
      toast.warning('Need 100 gold to purchase a bot')
      return
    }

    setIsPurchasing(true)

    try {
      const res = await fetch('/api/bot/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: botName.trim(),
          handle: botHandle.trim(),
          personality: botPersonality,
          paymentMethod,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Purchase failed')
        return
      }

      playSound('chest')
      toast.success(`Bot @${botHandle} created!`)
      setBotName('')
      setBotHandle('')
      setBotPersonality('neutral')
      refreshCredits()
      refreshGold()
      fetchBots()
    } catch {
      toast.error('Purchase failed')
    } finally {
      setIsPurchasing(false)
    }
  }

  const expandBot = (bot: Bot) => {
    if (expandedBot === bot.id) {
      setExpandedBot(null)
      return
    }
    setExpandedBot(bot.id)
    const config = bot.bot_configs?.[0]
    setEditPersonality(bot.personality)
    setEditCombatStrategy(config?.combat_strategy || 'passive')
    setEditBankingStrategy(config?.banking_strategy || 'none')
    setEditAutoHeal(config?.auto_heal_threshold ?? 50)
    setEditCustomPrompt(config?.custom_prompt || '')

    // Profile fields
    const profile = bot.users
    setEditName(profile?.name || bot.name)
    setEditHandle(bot.handle)
    setEditBio(profile?.bio || '')
    setEditAvatarUrl(profile?.avatar_url || '')
    setEditBannerUrl(profile?.banner_url || '')
    setAvatarPreview('')
    setBannerPreview('')
    setAvatarFile(null)
    setBannerFile(null)
  }

  const handleToggleActive = async (bot: Bot) => {
    const newActive = !bot.is_active
    try {
      const res = await fetch(`/api/bot/${bot.id}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newActive }),
      })
      if (res.ok) {
        setBots(prev => prev.map(b => b.id === bot.id ? { ...b, is_active: newActive } : b))
        toast.success(newActive ? 'Bot activated' : 'Bot deactivated')
      }
    } catch {
      toast.error('Failed to toggle bot')
    }
  }

  const handleSaveConfig = async (botId: string) => {
    setSavingConfig(botId)
    try {
      const res = await fetch(`/api/bot/${botId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personality: editPersonality,
          combat_strategy: editCombatStrategy,
          banking_strategy: editBankingStrategy,
          auto_heal_threshold: editAutoHeal,
          custom_prompt: editCustomPrompt || null,
        }),
      })
      if (res.ok) {
        toast.success('Config saved')
        fetchBots()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Save failed')
      }
    } catch {
      toast.error('Save failed')
    } finally {
      setSavingConfig(null)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.warning('Must be an image'); return }
    if (file.size > 2 * 1024 * 1024) { toast.warning('Avatar must be under 2MB'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.warning('Must be an image'); return }
    if (file.size > 4 * 1024 * 1024) { toast.warning('Banner must be under 4MB'); return }
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  const handleSaveProfile = async (botId: string) => {
    setSavingProfile(botId)
    try {
      const form = new FormData()
      form.append('name', editName)
      form.append('handle', editHandle)
      form.append('bio', editBio)
      if (avatarFile) form.append('avatar', avatarFile)
      if (bannerFile) form.append('banner', bannerFile)

      const res = await fetch(`/api/bot/${botId}/profile`, {
        method: 'PATCH',
        body: form,
      })

      if (res.ok) {
        toast.success('Profile saved')
        fetchBots()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Save failed')
      }
    } catch {
      toast.error('Save failed')
    } finally {
      setSavingProfile(null)
    }
  }

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          Datacenter
        </h1>
      </header>

      <div className="dc-content">
        {/* Deploy New Bot */}
        <section className="dc-section">
          <h2 className="dc-section-heading">Deploy New Bot</h2>
          <p className="dc-section-sub">Purchase an AI bot to automate actions on your behalf</p>

          <div className="dc-deploy-card">
            <div className="dc-deploy-fields">
              <div className="dc-field">
                <label className="dc-label">Bot Name</label>
                <input
                  type="text"
                  className="dc-input"
                  placeholder="My Bot"
                  value={botName}
                  onChange={e => setBotName(e.target.value)}
                  maxLength={30}
                />
              </div>

              <div className="dc-field">
                <label className="dc-label">Handle</label>
                <div className="dc-handle-wrap">
                  <span className="dc-handle-at">@</span>
                  <input
                    type="text"
                    className="dc-input dc-input-handle"
                    placeholder="my_bot"
                    value={botHandle}
                    onChange={e => setBotHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="dc-field">
                <label className="dc-label">Personality</label>
                <select
                  className="dc-input"
                  value={botPersonality}
                  onChange={e => setBotPersonality(e.target.value)}
                >
                  {PERSONALITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="dc-deploy-actions">
              <button
                className="btn btn-primary"
                onClick={() => handlePurchase('spits')}
                disabled={isPurchasing}
              >
                {isPurchasing ? 'Deploying...' : '1,000 Spits'}
              </button>
              <button
                className="dc-btn-gold"
                onClick={() => handlePurchase('gold')}
                disabled={isPurchasing}
              >
                {isPurchasing ? 'Deploying...' : '100 Gold'}
              </button>
            </div>
          </div>
        </section>

        {/* My Bots */}
        <section className="dc-section">
          <div className="dc-bots-heading">
            <h2 className="dc-section-heading" style={{ marginBottom: 0 }}>My Bots</h2>
            {bots.length > 0 && <span className="dc-count">{bots.length}</span>}
          </div>

          {loading ? (
            <div className="dc-empty">Loading...</div>
          ) : bots.length === 0 ? (
            <div className="dc-empty">No bots deployed yet</div>
          ) : (
            <div className="dc-bot-list">
              {bots.map(bot => (
                <div key={bot.id} className={`dc-bot ${expandedBot === bot.id ? 'dc-bot-expanded' : ''}`}>
                  <div className="dc-bot-row" onClick={() => expandBot(bot)}>
                    <div className="dc-bot-left">
                      <div className="dc-bot-avatar" style={bot.users?.avatar_url ? {
                        backgroundImage: `url(${bot.users.avatar_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        fontSize: 0,
                      } : undefined}>
                        {bot.users?.avatar_url ? '' : (bot.name[0]?.toUpperCase() || '?')}
                      </div>
                      <div className="dc-bot-meta">
                        <span className="dc-bot-name">{bot.name}</span>
                        <span className="dc-bot-handle">@{bot.handle}</span>
                      </div>
                      <span className={`dc-pill dc-pill-${bot.personality}`}>
                        {bot.personality}
                      </span>
                    </div>
                    <div className="dc-bot-right">
                      <button
                        className={`dc-switch ${bot.is_active ? 'dc-switch-on' : ''}`}
                        onClick={e => { e.stopPropagation(); handleToggleActive(bot) }}
                        title={bot.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <div className="dc-switch-thumb" />
                      </button>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        className={`dc-caret ${expandedBot === bot.id ? 'dc-caret-open' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>

                  {expandedBot === bot.id && (
                    <div className="dc-bot-panel">
                      {/* Profile Section */}
                      <div className="dc-profile-section">
                        <label className="dc-label" style={{ marginBottom: '0.5rem' }}>Profile</label>

                        {/* Banner */}
                        <div
                          className="image-upload dc-banner-upload"
                          style={{
                            backgroundImage: (bannerPreview || editBannerUrl) ? `url(${bannerPreview || editBannerUrl})` : undefined,
                          }}
                          onClick={() => bannerInputRef.current?.click()}
                        >
                          <input
                            ref={bannerInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleBannerChange}
                            style={{ display: 'none' }}
                          />
                          {!editBannerUrl && !bannerPreview && (
                            <div className="banner-upload-placeholder">
                              <span style={{ fontSize: '0.75rem', color: 'var(--sys-text-muted)' }}>Click to upload banner</span>
                            </div>
                          )}
                          <div className="image-upload-overlay">
                            <div className="image-upload-icon" style={{ width: '28px', height: '28px' }}>
                              <span className="sys-icon sys-icon-camera" style={{ fontSize: '0.75rem' }}></span>
                            </div>
                          </div>
                        </div>

                        {/* Avatar */}
                        <div
                          className="image-upload dc-avatar-upload"
                          style={{
                            backgroundImage: (avatarPreview || editAvatarUrl) ? `url(${avatarPreview || editAvatarUrl})` : undefined,
                          }}
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            style={{ display: 'none' }}
                          />
                          {!editAvatarUrl && !avatarPreview && (
                            <span className="avatar-upload-letter" style={{ fontSize: '1.5rem' }}>
                              {editName[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                          <div className="image-upload-overlay" style={{ borderRadius: '50%' }}>
                            <div className="image-upload-icon" style={{ width: '24px', height: '24px' }}>
                              <span className="sys-icon sys-icon-camera" style={{ fontSize: '0.65rem' }}></span>
                            </div>
                          </div>
                        </div>

                        {/* Name + Handle + Bio */}
                        <div className="dc-profile-fields">
                          <div className="dc-field">
                            <label className="dc-label">Name</label>
                            <input
                              type="text"
                              className="dc-input"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              maxLength={30}
                              placeholder="Bot name"
                            />
                          </div>
                          <div className="dc-field">
                            <label className="dc-label">Handle</label>
                            <div className="dc-handle-wrap">
                              <span className="dc-handle-at">@</span>
                              <input
                                type="text"
                                className="dc-input dc-input-handle"
                                value={editHandle}
                                onChange={e => setEditHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                maxLength={20}
                                placeholder="bot_handle"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="dc-field" style={{ marginBottom: '0.5rem' }}>
                          <label className="dc-label">Bio</label>
                          <textarea
                            className="dc-input dc-textarea"
                            value={editBio}
                            onChange={e => setEditBio(e.target.value)}
                            maxLength={160}
                            rows={2}
                            placeholder="Bot bio..."
                          />
                        </div>

                        <button
                          className="btn btn-primary dc-save-btn"
                          onClick={() => handleSaveProfile(bot.id)}
                          disabled={savingProfile === bot.id}
                          style={{ marginBottom: '0.75rem' }}
                        >
                          {savingProfile === bot.id ? 'Saving...' : 'Save Profile'}
                        </button>
                      </div>

                      <div className="dc-panel-grid">
                        <div className="dc-field">
                          <label className="dc-label">Personality</label>
                          <select
                            className="dc-input"
                            value={editPersonality}
                            onChange={e => setEditPersonality(e.target.value)}
                          >
                            {PERSONALITIES.map(p => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="dc-field">
                          <label className="dc-label">Combat</label>
                          <select
                            className="dc-input"
                            value={editCombatStrategy}
                            onChange={e => setEditCombatStrategy(e.target.value)}
                          >
                            {COMBAT_STRATEGIES.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="dc-field">
                          <label className="dc-label">Banking</label>
                          <select
                            className="dc-input"
                            value={editBankingStrategy}
                            onChange={e => setEditBankingStrategy(e.target.value)}
                          >
                            {BANKING_STRATEGIES.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="dc-field">
                          <label className="dc-label">Auto-Heal: {editAutoHeal}%</label>
                          <input
                            type="range"
                            min={10}
                            max={90}
                            step={5}
                            value={editAutoHeal}
                            onChange={e => setEditAutoHeal(Number(e.target.value))}
                            className="dc-range"
                          />
                        </div>
                      </div>

                      <div className="dc-field">
                        <label className="dc-label">Custom Prompt</label>
                        <textarea
                          className="dc-input dc-textarea"
                          placeholder="Additional instructions for the bot LLM..."
                          value={editCustomPrompt}
                          onChange={e => setEditCustomPrompt(e.target.value)}
                          rows={3}
                          maxLength={500}
                        />
                      </div>

                      <button
                        className="btn btn-primary dc-save-btn"
                        onClick={() => handleSaveConfig(bot.id)}
                        disabled={savingConfig === bot.id}
                      >
                        {savingConfig === bot.id ? 'Saving...' : 'Save Config'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
