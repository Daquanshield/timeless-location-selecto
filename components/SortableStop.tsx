'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import AddressSearch from './AddressSearch'
import type { Location, Stop } from '@/types'

interface SortableStopProps {
  stop: Stop
  index: number
  onSelect: (location: Location) => void
  onRemove: () => void
  isActive: boolean
  onFocus: () => void
}

export default function SortableStop({
  stop,
  index,
  onSelect,
  onRemove,
  isActive,
  onFocus
}: SortableStopProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stop.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto'
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle */}
      <button
        type="button"
        className="absolute left-0 top-1/2 -translate-y-1/2 -ml-8 p-2 text-charcoal-500 hover:text-gold-400 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder stop ${index + 1}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      <AddressSearch
        label={`Stop ${index + 1}`}
        placeholder={`Enter stop ${index + 1} address`}
        value={stop.address ? stop : null}
        onSelect={onSelect}
        isActive={isActive}
        onFocus={onFocus}
        icon="dropoff"
      />

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0 right-0 p-1 text-charcoal-400 hover:text-red-400 transition-colors"
        aria-label={`Remove stop ${index + 1}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  )
}
