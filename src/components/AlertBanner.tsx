import type { Alert } from '../types'
import { AlertTriangle, AlertCircle, Info, CheckCircle, X } from 'lucide-react'
import { useState } from 'react'

const styles = {
  error:   { bg: 'bg-red-50 border-red-200',    text: 'text-red-800',    Icon: AlertCircle   },
  warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800',  Icon: AlertTriangle },
  info:    { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-800',   Icon: Info          },
  success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800',  Icon: CheckCircle   },
}

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  const visible = alerts.filter((_, i) => !dismissed.has(i))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((alert, i) => {
        if (dismissed.has(i)) return null
        const { bg, text, Icon } = styles[alert.type]
        return (
          <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${bg} ${text}`}>
            <Icon size={16} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1 text-sm">{alert.message}</span>
            <button
              onClick={() => setDismissed((s) => new Set([...s, i]))}
              className="flex-shrink-0 hover:opacity-70"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
