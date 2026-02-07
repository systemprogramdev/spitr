'use client'

import { useState, useEffect, useCallback } from 'react'
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
  { value: 'hoard', label: 'Hoard' },
  { value: 'deposit_all', label: 'Deposit All' },
  { value: 'balanced', label: 'Balanced' },
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
                      <div className="dc-bot-avatar">
                        {bot.name[0]?.toUpperCase() || '?'}
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
