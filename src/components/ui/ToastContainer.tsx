'use client'

import { useToastStore } from '@/stores/toastStore'

const TYPE_CONFIG: Record<string, { borderColor: string; prefix: string }> = {
  success: { borderColor: 'var(--sys-accent)', prefix: '>' },
  error: { borderColor: 'var(--sys-danger)', prefix: '!' },
  warning: { borderColor: 'var(--sys-warning, #f59e0b)', prefix: '~' },
  info: { borderColor: 'var(--sys-primary)', prefix: '*' },
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => {
        const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.info
        return (
          <div
            key={t.id}
            className={`toast-item toast-${t.type}`}
            style={{ borderLeftColor: cfg.borderColor }}
            onClick={() => removeToast(t.id)}
          >
            <span className="toast-prefix" style={{ color: cfg.borderColor }}>
              [{cfg.prefix}]
            </span>
            <span className="toast-message">{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
