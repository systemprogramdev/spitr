'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { LotteryTicket } from '@/types'
import { TICKET_MAP } from '@/lib/bank'

interface ScratchCardProps {
  ticket: LotteryTicket
  onScratched: (ticketId: string) => void
}

export function ScratchCard({ ticket, onScratched }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScratching, setIsScratching] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [result, setResult] = useState<{ isWinner: boolean; prizeAmount: number; prizeCurrency: string } | null>(null)
  const scratchedRef = useRef(0)
  const isDrawingRef = useRef(false)

  const tier = TICKET_MAP.get(ticket.ticket_type)

  // Initialize canvas with scratch coating
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || revealed) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    // Draw scratch coating
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Add pattern
    ctx.fillStyle = '#2a2a4e'
    for (let x = 0; x < rect.width; x += 12) {
      for (let y = 0; y < rect.height; y += 12) {
        if ((x + y) % 24 === 0) {
          ctx.fillRect(x, y, 6, 6)
        }
      }
    }

    // Draw text
    ctx.fillStyle = '#4a4a6e'
    ctx.font = 'bold 14px var(--sys-font-display)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SCRATCH HERE', rect.width / 2, rect.height / 2)
  }, [revealed])

  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas || revealed) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = x - rect.left
    const scaleY = y - rect.top

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(scaleX, scaleY, 20, 0, Math.PI * 2)
    ctx.fill()

    // Count scratched pixels
    scratchedRef.current += 1
    const totalArea = (rect.width * rect.height) / (40 * 40) // rough cell count
    const percent = scratchedRef.current / totalArea

    if (percent > 0.3 && !revealed) {
      setRevealed(true)
      handleReveal()
    }
  }, [revealed])

  const handleReveal = async () => {
    try {
      const res = await fetch('/api/bank/scratch-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({
          isWinner: data.isWinner,
          prizeAmount: data.prizeAmount,
          prizeCurrency: data.prizeCurrency,
        })
        onScratched(ticket.id)

        // Play sound
        try {
          const sound = data.isWinner ? '/sounds/levelup.mp3' : '/sounds/spit.mp3'
          new Audio(sound).play()
        } catch {}
      }
    } catch (err) {
      console.error('Scratch error:', err)
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (revealed) return
    isDrawingRef.current = true
    setIsScratching(true)
    scratch(e.clientX, e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawingRef.current || revealed) return
    scratch(e.clientX, e.clientY)
  }

  const handlePointerUp = () => {
    isDrawingRef.current = false
    setIsScratching(false)
  }

  return (
    <div className="scratch-card">
      <div className="scratch-card-header">
        <span>{tier?.emoji}</span>
        <span>{tier?.name}</span>
      </div>
      <div className="scratch-card-body">
        {/* Result layer (underneath) */}
        <div className={`scratch-card-result ${revealed ? 'revealed' : ''}`}>
          {result ? (
            result.isWinner ? (
              <div className="scratch-card-win">
                <div className="scratch-card-win-label">WINNER!</div>
                <div className="scratch-card-win-amount">
                  +{result.prizeAmount.toFixed(2)} {result.prizeCurrency}
                </div>
              </div>
            ) : (
              <div className="scratch-card-lose">
                <div className="scratch-card-lose-label">NO LUCK</div>
                <div className="scratch-card-lose-sub">Try again!</div>
              </div>
            )
          ) : (
            <div className="scratch-card-pending">???</div>
          )}
        </div>
        {/* Canvas overlay */}
        {!revealed && (
          <canvas
            ref={canvasRef}
            className="scratch-card-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ touchAction: 'none' }}
          />
        )}
      </div>
    </div>
  )
}
