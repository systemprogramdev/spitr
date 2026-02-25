'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCredits } from '@/hooks/useCredits'
import { useSound } from '@/hooks/useSound'
import { toast } from '@/stores/toastStore'
import { SLOT_BET_LEVELS, PAYLINES } from '@/lib/slots'

const SYMBOL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

interface SpinResult {
  grid: number[][]
  wins: { lineIndex: number; symbolId: number; payout: number; wildMultiplier: number }[]
  totalPayout: number
  newBalance: number
  nudge: { row: number; col: number } | null
  bonus: { spins: number; grids: number[][][]; payouts: number[]; totalPayout: number } | null
  progressiveWin: { tier: string; amount: number } | null
  jackpotAmounts: { mini: number; major: number; mega: number } | null
  expandedCols: number[]
  scatterWin: { count: number; payout: number } | null
  cascades: { grid: number[][]; wins: any[]; payout: number; multiplier: number }[]
  holdOption: number[] | null
  canGamble: boolean
  streakMultiplier: number
}

type ReelState = 'idle' | 'spinning' | 'stopped'

interface BonusPhase {
  grids: number[][][]
  payouts: number[]
  current: number
  runningTotal: number
}

interface CascadePhase {
  steps: { grid: number[][]; payout: number; multiplier: number }[]
  current: number
  runningTotal: number
}

interface GambleState {
  amount: number
  count: number
  result: 'pending' | 'won' | 'lost' | null
}

export function SlotMachine() {
  const { balance, refreshBalance } = useCredits()
  const { playSound } = useSound()

  const [grid, setGrid] = useState<number[][]>([
    [1, 6, 5],
    [3, 2, 4],
    [7, 8, 9],
  ])

  const [betIndex, setBetIndex] = useState(0)
  const bet = SLOT_BET_LEVELS[betIndex]

  const [isSpinning, setIsSpinning] = useState(false)
  const [reelStates, setReelStates] = useState<ReelState[]>(['idle', 'idle', 'idle'])
  const [winningLines, setWinningLines] = useState<number[]>([])
  const [lastWin, setLastWin] = useState(0)
  const [autoplay, setAutoplay] = useState(false)
  const autoplayRef = useRef(false)

  // Nudge
  const [nudgedCell, setNudgedCell] = useState<{ row: number; col: number } | null>(null)

  // Progressive
  const [jackpot, setJackpot] = useState({ mini: 100, major: 1000, mega: 10000 })
  const [progressiveWin, setProgressiveWin] = useState<{ tier: string; amount: number } | null>(null)

  // Bonus round
  const [bonusPhase, setBonusPhase] = useState<BonusPhase | null>(null)
  const [bonusIntro, setBonusIntro] = useState(false)

  // Free spins
  const [freeSpins, setFreeSpins] = useState(0)

  // NEW: Expanding wilds
  const [expandedCols, setExpandedCols] = useState<number[]>([])

  // NEW: Cascade
  const [cascadePhase, setCascadePhase] = useState<CascadePhase | null>(null)

  // NEW: Gamble
  const [gambleState, setGambleState] = useState<GambleState | null>(null)

  // NEW: Hold & Respin
  const [holdOption, setHoldOption] = useState<number[] | null>(null)

  // NEW: Streak
  const [streak, setStreak] = useState(0)

  // Refs
  const spinInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppedCols = useRef<Map<number, number[]>>(new Map())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const spinRef = useRef<() => void>(() => {})
  const lastSpinData = useRef<SpinResult | null>(null)
  const handlePostWinRef = useRef<(data: SpinResult) => void>(() => {})

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
    return t
  }, [])

  // Fetch progressive on mount + poll
  useEffect(() => {
    const fetchJp = async () => {
      try {
        const res = await fetch('/api/bank/slot-jackpot')
        if (res.ok) setJackpot(await res.json())
      } catch { /* skip */ }
    }
    fetchJp()
    const iv = setInterval(fetchJp, 10000)
    return () => clearInterval(iv)
  }, [])

  // ---- Post-win handler (progressive, bonus, gamble, hold, autoplay) ----
  const handlePostWin = useCallback((data: SpinResult) => {
    // Progressive win
    if (data.progressiveWin) {
      setProgressiveWin(data.progressiveWin)
      playSound('bonus')
      toast.success(
        `${data.progressiveWin.tier.toUpperCase()} JACKPOT! +${data.progressiveWin.amount.toLocaleString()} spits!`
      )
      schedule(() => setProgressiveWin(null), 4000)
    }

    // Bonus → enter bonus phase
    if (data.bonus && data.bonus.grids.length > 0) {
      setBonusIntro(true)
      playSound('bonus')
      toast.success(`BONUS! ${data.bonus.spins} FREE SPINS!`)
      schedule(() => {
        setBonusIntro(false)
        // Don't set freeSpins — bonus grids are pre-resolved server-side
        setBonusPhase({
          grids: data.bonus!.grids,
          payouts: data.bonus!.payouts,
          current: 0,
          runningTotal: 0,
        })
      }, 1500)
      refreshBalance()
      return
    }

    // Show total payout toast
    if (data.totalPayout > 0) {
      toast.success(`+${data.totalPayout.toLocaleString()} spits!`)
    }

    // Update streak
    if (data.totalPayout > 0) {
      setStreak((s) => s + 1)
    } else {
      setStreak(0)
    }

    refreshBalance()

    // Gamble option (not during autoplay)
    if (!autoplayRef.current && data.canGamble && data.totalPayout > 0) {
      setGambleState({ amount: data.totalPayout, count: 0, result: null })
      setIsSpinning(false)
      return
    }

    // Hold option (not during autoplay, only on losses)
    if (!autoplayRef.current && data.holdOption && data.totalPayout === 0) {
      setHoldOption(data.holdOption)
      setIsSpinning(false)
      return
    }

    setIsSpinning(false)

    // Autoplay / free spins continuation
    if (autoplayRef.current || freeSpins > 0) {
      schedule(() => {
        if (autoplayRef.current || freeSpins > 0) spinRef.current()
      }, 1200)
    }
  }, [playSound, refreshBalance, schedule, freeSpins])

  useEffect(() => { handlePostWinRef.current = handlePostWin })

  // ---- Cascade phase animation ----
  useEffect(() => {
    if (!cascadePhase) return
    const { current, steps } = cascadePhase

    if (current >= steps.length) {
      schedule(() => {
        setCascadePhase(null)
        const data = lastSpinData.current
        if (data) handlePostWinRef.current(data)
      }, 1000)
      return
    }

    // Quick blur then reveal
    setReelStates(['spinning', 'spinning', 'spinning'])

    schedule(() => {
      setGrid(steps[current].grid)
      setReelStates(['stopped', 'stopped', 'stopped'])
      if (steps[current].payout > 0) playSound('payout')
    }, 200)

    schedule(() => {
      setCascadePhase((prev) =>
        prev
          ? {
              ...prev,
              current: prev.current + 1,
              runningTotal: prev.runningTotal + steps[current].payout,
            }
          : null
      )
      setReelStates(['idle', 'idle', 'idle'])
    }, 800)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cascadePhase?.current])

  // ---- Bonus round animation ----
  useEffect(() => {
    if (!bonusPhase) return
    const { current, grids, payouts } = bonusPhase

    if (current >= grids.length) {
      schedule(() => {
        setBonusPhase(null)
        setIsSpinning(false)
        if (autoplayRef.current) {
          schedule(() => spinRef.current(), 1000)
        }
      }, 2500)
      return
    }

    setReelStates(['spinning', 'spinning', 'spinning'])

    schedule(() => {
      setGrid(grids[current])
      setReelStates(['stopped', 'stopped', 'stopped'])
      if (payouts[current] > 0) playSound('payout')
    }, 250)

    schedule(() => {
      setBonusPhase((prev) =>
        prev
          ? {
              ...prev,
              current: prev.current + 1,
              runningTotal: prev.runningTotal + payouts[current],
            }
          : null
      )
      setReelStates(['idle', 'idle', 'idle'])
    }, 750)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonusPhase?.current])

  const startReelAnimation = useCallback((skipCols?: number[]) => {
    if (spinInterval.current) clearInterval(spinInterval.current)
    stoppedCols.current.clear()
    spinInterval.current = setInterval(() => {
      setGrid((prev) => {
        const g = prev.map((r) => [...r])
        for (let c = 0; c < 3; c++) {
          if (skipCols?.includes(c)) continue
          if (!stoppedCols.current.has(c)) {
            for (let r = 0; r < 3; r++)
              g[r][c] = SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]
          }
        }
        return g
      })
    }, 75)
  }, [])

  const stopReel = useCallback((col: number, colSymbols: number[]) => {
    stoppedCols.current.set(col, colSymbols)
    setGrid((prev) => {
      const g = prev.map((r) => [...r])
      for (let r = 0; r < 3; r++) g[r][col] = colSymbols[r]
      return g
    })
    setReelStates((prev) => {
      const n = [...prev] as ReelState[]
      n[col] = 'stopped'
      return n
    })
    if (stoppedCols.current.size >= 3 && spinInterval.current) {
      clearInterval(spinInterval.current)
      spinInterval.current = null
    }
  }, [])

  // ---- Main spin ----
  const spin = useCallback(async () => {
    if (isSpinning || bonusPhase || cascadePhase || gambleState) return
    const isFree = freeSpins > 0
    if (!isFree && balance < bet) {
      toast.error('Insufficient spits!')
      setAutoplay(false)
      autoplayRef.current = false
      return
    }

    setIsSpinning(true)
    setWinningLines([])
    setLastWin(0)
    setNudgedCell(null)
    setProgressiveWin(null)
    setBonusIntro(false)
    setExpandedCols([])
    setHoldOption(null)
    setGambleState(null)
    setReelStates(['spinning', 'spinning', 'spinning'])
    playSound('spin')
    startReelAnimation()

    if (isFree) setFreeSpins((n) => n - 1)

    try {
      const [res] = await Promise.all([
        fetch('/api/bank/spin-slot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bet, isFreeSpin: isFree, currentStreak: streak }),
        }),
        new Promise((r) => setTimeout(r, 600)),
      ])

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Spin failed')
      }

      const data: SpinResult = await res.json()
      lastSpinData.current = data

      if (data.jackpotAmounts) setJackpot(data.jackpotAmounts)

      // Stop reels with stagger
      ;[0, 400, 800].forEach((delay, col) => {
        schedule(() => {
          stopReel(col, data.grid.map((row) => row[col]))
          playSound('check')
        }, delay)
      })

      // After reels stop
      schedule(() => {
        // Expanding wilds glow
        if (data.expandedCols && data.expandedCols.length > 0) {
          setExpandedCols(data.expandedCols)
          schedule(() => setExpandedCols([]), 2000)
        }

        // Nudge animation
        if (data.nudge) {
          setNudgedCell(data.nudge)
          schedule(() => setNudgedCell(null), 1500)
        }

        // Show initial wins
        if (data.wins.length > 0) {
          setWinningLines(data.wins.map((w) => w.lineIndex))
          const linePayout = data.wins.reduce((s, w) => s + w.payout, 0)
          setLastWin(linePayout)
          playSound('payout')
        }

        // Scatter toast
        if (data.scatterWin) {
          toast.success(`SCATTER! ${data.scatterWin.count} Diamonds = +${data.scatterWin.payout} spits!`)
        }

        // Determine next phase timing
        const hasInitialWins = data.wins.length > 0 || data.scatterWin
        const nextDelay = hasInitialWins ? 2000 : 500

        schedule(() => {
          setWinningLines([])
          setLastWin(0)

          // Enter cascade phase if cascades exist
          if (data.cascades && data.cascades.length > 0) {
            setCascadePhase({
              steps: data.cascades,
              current: 0,
              runningTotal: 0,
            })
            return // cascade effect handles rest
          }

          // No cascade — go straight to post-win
          handlePostWinRef.current(data)
        }, nextDelay)
      }, 1000)
    } catch (err: any) {
      if (spinInterval.current) clearInterval(spinInterval.current)
      setReelStates(['idle', 'idle', 'idle'])
      setIsSpinning(false)
      toast.error(err?.message || 'Spin failed')
      setAutoplay(false)
      autoplayRef.current = false
    }
  }, [isSpinning, bonusPhase, cascadePhase, gambleState, balance, bet, freeSpins, streak, playSound, startReelAnimation, stopReel, schedule])

  useEffect(() => { spinRef.current = spin })

  // ---- Gamble handler ----
  const doGamble = useCallback(async () => {
    if (!gambleState || gambleState.result === 'pending') return

    setGambleState((prev) => prev ? { ...prev, result: 'pending' } : null)
    playSound('spin')

    try {
      const res = await fetch('/api/bank/slot-gamble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: gambleState.amount }),
      })

      if (!res.ok) throw new Error('Gamble failed')
      const data = await res.json()

      if (data.won) {
        playSound('payout')
        setGambleState((prev) =>
          prev
            ? { amount: prev.amount * 2, count: prev.count + 1, result: 'won' }
            : null
        )
      } else {
        playSound('losing')
        setGambleState((prev) =>
          prev ? { ...prev, amount: 0, result: 'lost' } : null
        )
        schedule(() => {
          setGambleState(null)
          refreshBalance()
        }, 1500)
      }

      refreshBalance()
    } catch {
      toast.error('Gamble failed')
      setGambleState(null)
      refreshBalance()
    }
  }, [gambleState, playSound, schedule, refreshBalance])

  const collectGamble = useCallback(() => {
    setGambleState(null)
    refreshBalance()
  }, [refreshBalance])

  // ---- Hold & Respin handler ----
  const doRespin = useCallback(async () => {
    if (!holdOption || isSpinning) return

    setIsSpinning(true)
    setHoldOption(null)
    setWinningLines([])
    setLastWin(0)

    // Animate only non-held columns
    const heldCols = holdOption
    setReelStates((prev) => {
      const n = [...prev] as ReelState[]
      for (let c = 0; c < 3; c++) n[c] = heldCols.includes(c) ? 'idle' : 'spinning'
      return n
    })
    playSound('spin')
    startReelAnimation(heldCols)

    try {
      const [res] = await Promise.all([
        fetch('/api/bank/slot-respin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bet, holdCols: heldCols, currentGrid: grid }),
        }),
        new Promise((r) => setTimeout(r, 600)),
      ])

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Respin failed')
      }

      const data = await res.json()

      // Stop non-held reels
      for (let col = 0; col < 3; col++) {
        if (heldCols.includes(col)) continue
        schedule(() => {
          stopReel(col, data.grid.map((row: number[]) => row[col]))
          playSound('check')
        }, (col - Math.min(...heldCols.filter((c: number) => c !== col).concat([0]))) * 400)
      }

      schedule(() => {
        if (data.expandedCols?.length > 0) {
          setExpandedCols(data.expandedCols)
          schedule(() => setExpandedCols([]), 2000)
        }

        if (data.wins.length > 0) {
          setWinningLines(data.wins.map((w: any) => w.lineIndex))
          const payout = data.wins.reduce((s: number, w: any) => s + w.payout, 0)
          setLastWin(payout)
          playSound('payout')
          schedule(() => { setWinningLines([]); setLastWin(0) }, 2000)
        } else {
          playSound('losing')
        }

        if (data.scatterWin) {
          toast.success(`SCATTER! ${data.scatterWin.count} Diamonds = +${data.scatterWin.payout} spits!`)
        }

        schedule(() => {
          if (data.totalPayout > 0) {
            toast.success(`+${data.totalPayout.toLocaleString()} spits!`)
            setStreak((s) => s + 1)

            if (data.canGamble) {
              setGambleState({ amount: data.totalPayout, count: 0, result: null })
              setIsSpinning(false)
              refreshBalance()
              return
            }
          } else {
            setStreak(0)
          }

          setIsSpinning(false)
          refreshBalance()

          if (autoplayRef.current) {
            schedule(() => spinRef.current(), 1200)
          }
        }, data.wins.length > 0 ? 2000 : 500)
      }, 800)
    } catch (err: any) {
      if (spinInterval.current) clearInterval(spinInterval.current)
      setReelStates(['idle', 'idle', 'idle'])
      setIsSpinning(false)
      toast.error(err?.message || 'Respin failed')
    }
  }, [holdOption, isSpinning, bet, grid, playSound, startReelAnimation, stopReel, schedule, refreshBalance])

  const skipHold = useCallback(() => {
    setHoldOption(null)
    playSound('losing')
    if (autoplayRef.current) {
      schedule(() => spinRef.current(), 800)
    }
  }, [playSound, schedule])

  const toggleAutoplay = useCallback(() => {
    if (autoplayRef.current) {
      autoplayRef.current = false
      setAutoplay(false)
    } else {
      autoplayRef.current = true
      setAutoplay(true)
      if (!isSpinning && !gambleState && !holdOption) spin()
    }
  }, [isSpinning, gambleState, holdOption, spin])

  const increaseBet = () => setBetIndex((i) => Math.min(i + 1, SLOT_BET_LEVELS.length - 1))
  const decreaseBet = () => setBetIndex((i) => Math.max(i - 1, 0))
  const maxBet = () => setBetIndex(SLOT_BET_LEVELS.length - 1)

  useEffect(() => {
    return () => {
      if (spinInterval.current) clearInterval(spinInterval.current)
      timers.current.forEach(clearTimeout)
      autoplayRef.current = false
    }
  }, [])

  const isWinningCell = (row: number, col: number) =>
    winningLines.some((li) => PAYLINES[li].some(([r, c]) => r === row && c === col))

  const busy = isSpinning || !!bonusPhase || !!cascadePhase

  const streakMult = streak >= 5 ? 3 : streak >= 4 ? 2 : streak >= 3 ? 1.5 : 1

  return (
    <div className="slot-machine">
      {/* Progressive jackpot tiers */}
      <div className="slot-progressive">
        <div className="slot-jp slot-jp-mini">
          <span className="slot-jp-label">MINI</span>
          <span className="slot-jp-amount">{Math.floor(jackpot.mini).toLocaleString()}</span>
        </div>
        <div className="slot-jp slot-jp-major">
          <span className="slot-jp-label">MAJOR</span>
          <span className="slot-jp-amount">{Math.floor(jackpot.major).toLocaleString()}</span>
        </div>
        <div className="slot-jp slot-jp-mega">
          <span className="slot-jp-label">MEGA</span>
          <span className="slot-jp-amount">{Math.floor(jackpot.mega).toLocaleString()}</span>
        </div>
      </div>

      {/* Streak multiplier badge */}
      {streak >= 3 && (
        <div className="slot-streak-badge">
          STREAK x{streak} &rarr; {streakMult}x MULTIPLIER
        </div>
      )}

      {/* Grid */}
      <div className="slot-grid-wrapper">
        <img src="/images/cyberpunk_slot/grid.png" alt="" className="slot-grid-frame" draggable={false} />
        <div className="slot-grid">
          {[0, 1, 2].map((row) =>
            [0, 1, 2].map((col) => (
              <div
                key={`${row}-${col}`}
                className={[
                  'slot-cell',
                  reelStates[col] === 'spinning' ? 'slot-reel-spinning' : '',
                  reelStates[col] === 'stopped' ? 'slot-reel-stopping' : '',
                  isWinningCell(row, col) ? 'slot-win-cell' : '',
                  nudgedCell?.row === row && nudgedCell?.col === col ? 'slot-nudge-cell' : '',
                  expandedCols.includes(col) ? 'slot-expand-wild' : '',
                  holdOption?.includes(col) ? 'slot-hold-col' : '',
                ].filter(Boolean).join(' ')}
              >
                <img
                  src={`/images/cyberpunk_slot/${grid[row][col]}.png`}
                  alt="" className="slot-symbol" draggable={false}
                />
                {holdOption?.includes(col) && row === 1 && (
                  <span className="slot-hold-badge">HELD</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Win overlay */}
        {lastWin > 0 && !bonusPhase && !bonusIntro && !progressiveWin && !cascadePhase && (
          <div className="slot-win-overlay">
            <span className="slot-win-amount">+{lastWin.toLocaleString()}</span>
            <span className="slot-win-label">SPITS</span>
            {streakMult > 1 && <span className="slot-win-mult">{streakMult}x STREAK</span>}
          </div>
        )}

        {/* Cascade HUD */}
        {cascadePhase && (
          <div className="slot-cascade-hud">
            <span className="slot-cascade-label">
              CASCADE {Math.min(cascadePhase.current + 1, cascadePhase.steps.length)}/{cascadePhase.steps.length}
            </span>
            <span className="slot-cascade-mult">
              {cascadePhase.current < cascadePhase.steps.length
                ? `${cascadePhase.steps[cascadePhase.current].multiplier}x`
                : ''}
            </span>
            {cascadePhase.runningTotal > 0 && (
              <span className="slot-cascade-total">+{cascadePhase.runningTotal.toLocaleString()}</span>
            )}
          </div>
        )}

        {/* Bonus intro overlay */}
        {bonusIntro && (
          <div className="slot-win-overlay slot-bonus-overlay">
            <span className="slot-bonus-title">BONUS!</span>
            <span className="slot-bonus-detail">10 FREE SPINS</span>
          </div>
        )}

        {/* Bonus phase HUD */}
        {bonusPhase && (
          <div className="slot-bonus-hud">
            <span className="slot-bonus-hud-spin">
              FREE SPIN {Math.min(bonusPhase.current + 1, bonusPhase.grids.length)}/{bonusPhase.grids.length}
            </span>
            {bonusPhase.runningTotal > 0 && (
              <span className="slot-bonus-hud-total">+{bonusPhase.runningTotal.toLocaleString()}</span>
            )}
          </div>
        )}

        {/* Progressive win overlay */}
        {progressiveWin && (
          <div className={`slot-win-overlay slot-jackpot-overlay slot-jackpot-${progressiveWin.tier}`}>
            <span className="slot-jackpot-title">{progressiveWin.tier.toUpperCase()} JACKPOT</span>
            <span className="slot-win-amount">+{progressiveWin.amount.toLocaleString()}</span>
            <span className="slot-win-label">SPITS</span>
          </div>
        )}

        {/* Gamble overlay */}
        {gambleState && (
          <div className="slot-gamble-overlay">
            {gambleState.result === 'lost' ? (
              <>
                <span className="slot-gamble-lost">LOST!</span>
                <span className="slot-gamble-zero">0 SPITS</span>
              </>
            ) : gambleState.result === 'won' ? (
              <>
                <span className="slot-gamble-won">DOUBLED!</span>
                <span className="slot-gamble-amount">
                  {gambleState.amount.toLocaleString()} SPITS
                </span>
                <div className="slot-gamble-buttons">
                  {gambleState.count < 5 && (
                    <button className="slot-gamble-btn slot-gamble-btn-risk" onClick={doGamble}>
                      GAMBLE AGAIN
                    </button>
                  )}
                  <button className="slot-gamble-btn slot-gamble-btn-collect" onClick={collectGamble}>
                    COLLECT
                  </button>
                </div>
              </>
            ) : gambleState.result === 'pending' ? (
              <>
                <span className="slot-gamble-title">FLIPPING...</span>
                <div className="slot-gamble-coin slot-gamble-coin-flip">?</div>
              </>
            ) : (
              <>
                <span className="slot-gamble-title">DOUBLE OR NOTHING</span>
                <span className="slot-gamble-amount">
                  {gambleState.amount.toLocaleString()} SPITS
                </span>
                <div className="slot-gamble-buttons">
                  <button className="slot-gamble-btn slot-gamble-btn-risk" onClick={doGamble}>
                    GAMBLE
                  </button>
                  <button className="slot-gamble-btn slot-gamble-btn-collect" onClick={collectGamble}>
                    COLLECT
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hold & Respin bar */}
      {holdOption && !isSpinning && (
        <div className="slot-hold-bar">
          <span className="slot-hold-label">NEAR MISS! Hold &amp; Respin?</span>
          <div className="slot-hold-buttons">
            <button className="slot-hold-btn slot-hold-btn-respin" onClick={doRespin}>
              RESPIN (½ BET)
            </button>
            <button className="slot-hold-btn slot-hold-btn-skip" onClick={skipHold}>
              SKIP
            </button>
          </div>
        </div>
      )}

      {/* Free spins badge */}
      {freeSpins > 0 && !bonusPhase && (
        <div className="slot-free-spins-badge">FREE SPINS: {freeSpins}</div>
      )}

      {/* Balance bar */}
      <div className="slot-balance-bar">
        <img src="/images/cyberpunk_slot/coins.png" alt="" className="slot-coins-icon" draggable={false} />
        <span className="slot-balance-amount">{balance.toLocaleString()}</span>
        <span className="slot-balance-unit">spits</span>
      </div>

      {/* Control bar */}
      <div className="slot-control-bar">
        <div className="slot-ctrl-group">
          <button className={`slot-btn ${autoplay ? 'slot-btn-active' : ''}`} onClick={toggleAutoplay}>
            <img src="/images/cyberpunk_slot/autoplay.png" alt="AUTO" draggable={false} />
          </button>
        </div>
        <div className="slot-ctrl-divider" />
        <div className="slot-ctrl-group">
          <button className="slot-btn" onClick={decreaseBet} disabled={busy || !!gambleState || betIndex === 0}>
            <img src="/images/cyberpunk_slot/minus.png" alt="-" draggable={false} />
          </button>
          <div className="slot-bet-display">
            <span className="slot-bet-label">BET</span>
            <span className="slot-bet-value">{bet}</span>
          </div>
          <button className="slot-btn" onClick={increaseBet} disabled={busy || !!gambleState || betIndex === SLOT_BET_LEVELS.length - 1}>
            <img src="/images/cyberpunk_slot/plus.png" alt="+" draggable={false} />
          </button>
          <button className="slot-btn" onClick={maxBet} disabled={busy || !!gambleState}>
            <img src="/images/cyberpunk_slot/max bet.png" alt="MAX" draggable={false} />
          </button>
        </div>
        <div className="slot-ctrl-divider" />
        <div className="slot-ctrl-group">
          <button className="slot-btn slot-btn-spin" onClick={spin} disabled={busy || !!gambleState || !!holdOption}>
            <img src="/images/cyberpunk_slot/spin.png" alt="SPIN" draggable={false} />
          </button>
        </div>
      </div>
    </div>
  )
}
