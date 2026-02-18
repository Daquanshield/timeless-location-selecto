'use client'

import { useState } from 'react'

interface Driver {
  phone: string
  name: string
}

interface DriverSelectorProps {
  drivers: Driver[]
  currentDriverPhone: string | null
  onAssign: (driverPhone: string) => Promise<void>
}

export default function DriverSelector({ drivers, currentDriverPhone, onAssign }: DriverSelectorProps) {
  const [selected, setSelected] = useState(currentDriverPhone || '')
  const [assigning, setAssigning] = useState(false)

  const handleAssign = async () => {
    if (!selected || selected === currentDriverPhone) return
    setAssigning(true)
    await onAssign(selected)
    setAssigning(false)
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="text-cream/40 text-xs block mb-1">Assign Driver</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="input-field text-sm py-2"
        >
          <option value="">Select driver...</option>
          {drivers.map(d => (
            <option key={d.phone} value={d.phone}>
              {d.name} {d.phone === currentDriverPhone ? '(current)' : ''}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleAssign}
        disabled={assigning || !selected || selected === currentDriverPhone}
        className="btn-primary py-2 px-4 text-sm"
        style={{ minHeight: 'auto' }}
      >
        {assigning ? '...' : 'Assign'}
      </button>
    </div>
  )
}
