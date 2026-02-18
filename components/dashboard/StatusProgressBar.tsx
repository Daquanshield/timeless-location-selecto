'use client'

import type { RideStatus } from '@/lib/dashboard-types'

const STEPS: { key: RideStatus; label: string }[] = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'en_route', label: 'En Route' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

const STATUS_ORDER: Record<string, number> = {
  pending: -1,
  confirmed: 0,
  en_route: 1,
  arrived: 2,
  in_progress: 3,
  completed: 4,
  cancelled: -2,
}

interface StatusProgressBarProps {
  currentStatus: RideStatus
  onAdvance?: (nextStatus: RideStatus) => void
}

export default function StatusProgressBar({ currentStatus, onAdvance }: StatusProgressBarProps) {
  const currentIndex = STATUS_ORDER[currentStatus] ?? -1

  if (currentStatus === 'cancelled') {
    return (
      <div className="text-center py-4">
        <span className="text-red-400 font-medium">Ride Cancelled</span>
      </div>
    )
  }

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-charcoal-light" style={{ background: '#3a3a3a' }} />
        <div
          className="absolute top-4 left-0 h-0.5 transition-all duration-500"
          style={{
            background: 'var(--gold)',
            width: `${Math.max(0, (currentIndex / (STEPS.length - 1)) * 100)}%`,
          }}
        />

        {STEPS.map((step, i) => {
          const isCompleted = i < currentIndex
          const isCurrent = i === currentIndex
          const isNext = i === currentIndex + 1
          const isFuture = i > currentIndex

          return (
            <div key={step.key} className="relative flex flex-col items-center z-10">
              <button
                disabled={!isNext || !onAdvance}
                onClick={() => isNext && onAdvance?.(step.key)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? 'bg-gold text-charcoal'
                    : isCurrent
                    ? 'border-2 border-gold bg-charcoal'
                    : isNext && onAdvance
                    ? 'border-2 border-gold/50 bg-charcoal hover:border-gold cursor-pointer'
                    : 'border border-charcoal-light bg-charcoal'
                }`}
                style={isFuture && !isNext ? { borderColor: '#3a3a3a' } : {}}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
                ) : null}
              </button>
              <span className={`text-xs mt-1.5 whitespace-nowrap ${
                isCompleted || isCurrent ? 'text-gold' : 'text-cream/30'
              }`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
