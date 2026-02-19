'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

interface Notification {
  id: string
  type: 'new_ride' | 'status_change'
  message: string
  timestamp: string
  ride_id: string
}

interface NotificationBellProps {
  basePath: string
}

export default function NotificationBell({ basePath }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const lastChecked = useRef<string>(new Date().toISOString())

  const fetchNotifications = useCallback(async () => {
    const res = await fetch(`/api/dashboard/notifications?since=${encodeURIComponent(lastChecked.current)}`)
    if (!res.ok) return

    const data = await res.json()
    if (data.notifications && data.notifications.length > 0) {
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id))
        const newItems = data.notifications.filter((n: Notification) => !existingIds.has(n.id))
        const merged = [...newItems, ...prev].slice(0, 30)
        setUnreadCount(c => c + newItems.length)
        return merged
      })
      lastChecked.current = new Date().toISOString()
    }
  }, [])

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleToggle = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) setUnreadCount(0)
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Popover open={open} onOpenChange={handleToggle}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-[10px] font-bold bg-destructive text-white" style={{ minWidth: '18px', height: '18px', padding: '0 4px' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-4 py-3">
          <span className="text-foreground font-medium text-sm">Notifications</span>
        </div>
        <Separator />
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">
            No recent notifications
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map(n => (
              <a
                key={n.id}
                href={`${basePath}/ride/${n.ride_id}`}
                className="block px-4 py-3 hover:bg-secondary transition-colors border-b border-border/50"
                onClick={() => setOpen(false)}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0">
                    {n.type === 'new_ride' ? (
                      <span className="w-2 h-2 rounded-full bg-green-500 block" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-primary block" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground/80 text-sm truncate">{n.message}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{formatTime(n.timestamp)}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
