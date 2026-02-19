'use client'

import { useState } from 'react'
import { Check, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  no_show: -3,
}

interface StatusProgressBarProps {
  currentStatus: RideStatus
  onAdvance?: (nextStatus: RideStatus) => void
  onUndo?: (prevStatus: RideStatus) => void
}

export default function StatusProgressBar({ currentStatus, onAdvance, onUndo }: StatusProgressBarProps) {
  const currentIndex = STATUS_ORDER[currentStatus] ?? -1
  const [pendingStep, setPendingStep] = useState<RideStatus | null>(null)

  if (currentStatus === 'cancelled') {
    return (
      <div className="text-center py-4">
        <span className="text-destructive-foreground font-medium">Ride Cancelled</span>
      </div>
    )
  }

  if (currentStatus === 'no_show') {
    return (
      <div className="text-center py-4">
        <span className="text-orange-400 font-medium">Client No Show</span>
      </div>
    )
  }

  const handleStepClick = (stepKey: RideStatus) => {
    setPendingStep(stepKey)
  }

  const handleConfirmAdvance = () => {
    if (pendingStep && onAdvance) {
      onAdvance(pendingStep)
    }
    setPendingStep(null)
  }

  // Find previous status for undo
  const prevStep = currentIndex > 0 ? STEPS[currentIndex - 1] : null

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500"
          style={{
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
                disabled={!isNext || !onAdvance || !!pendingStep}
                onClick={() => isNext && handleStepClick(step.key)}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'border-2 border-primary bg-background',
                  isNext && onAdvance && 'border-2 border-primary/50 bg-background hover:border-primary cursor-pointer',
                  isFuture && !isNext && 'border border-border bg-background',
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                ) : null}
              </button>
              <span className={cn(
                'text-xs mt-1.5 whitespace-nowrap',
                (isCompleted || isCurrent) ? 'text-primary' : 'text-muted-foreground/50',
              )}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Confirmation dialog */}
      {pendingStep && (
        <div className="mt-4 p-3 rounded-lg text-center bg-primary/10 border border-primary/30">
          <p className="text-foreground text-sm mb-3">
            Change status to <span className="text-primary font-medium">{STEPS.find(s => s.key === pendingStep)?.label}</span>?
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingStep(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmAdvance}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}

      {/* Undo button */}
      {!pendingStep && prevStep && onUndo && currentStatus !== 'completed' && (
        <div className="mt-3 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUndo(prevStep.key)}
            className="text-muted-foreground hover:text-foreground text-xs gap-1"
          >
            <Undo2 className="h-3 w-3" />
            Undo to {prevStep.label}
          </Button>
        </div>
      )}
    </div>
  )
}
