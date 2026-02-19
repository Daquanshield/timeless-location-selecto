'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
        <Label className="text-muted-foreground text-xs">Assign Driver</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select driver..." />
          </SelectTrigger>
          <SelectContent>
            {drivers.map(d => (
              <SelectItem key={d.phone} value={d.phone}>
                {d.name} {d.phone === currentDriverPhone ? '(current)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={handleAssign}
        disabled={assigning || !selected || selected === currentDriverPhone}
        size="sm"
      >
        {assigning ? '...' : 'Assign'}
      </Button>
    </div>
  )
}
