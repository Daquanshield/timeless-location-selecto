import { sendSMS } from '@/lib/sms'
import type { RideStatus } from '@/lib/dashboard-types'

interface RideNotificationData {
  client_phone?: string | null
  client_contact_id?: string | null
  client_name?: string | null
  driver_name?: string | null
  vehicle_type?: string | null
  pickup_datetime?: string | null
  pickup_address?: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getDriverFirstName(name?: string | null): string {
  if (!name) return 'your driver'
  return name.split(' ')[0]
}

const MESSAGE_TEMPLATES: Partial<Record<RideStatus, (ride: RideNotificationData) => string>> = {
  confirmed: (ride) =>
    `Your ride on ${ride.pickup_datetime ? formatDate(ride.pickup_datetime) : 'your scheduled date'} is confirmed. ${ride.driver_name ? `Your driver ${getDriverFirstName(ride.driver_name)} will be driving a ${ride.vehicle_type || 'luxury SUV'}.` : ''} Thank you for choosing Timeless Rides.`,

  en_route: (ride) =>
    `Your driver ${getDriverFirstName(ride.driver_name)} is on the way to ${ride.pickup_address || 'your pickup location'}! Please be ready.`,

  arrived: (ride) =>
    `Your driver has arrived${ride.vehicle_type ? `. Look for the ${ride.vehicle_type}` : ''}. - Timeless Rides`,

  completed: () =>
    `Thank you for riding with Timeless Rides. We appreciate your business and look forward to serving you again.`,

  cancelled: (ride) =>
    `Your ride${ride.pickup_datetime ? ` on ${formatDate(ride.pickup_datetime)}` : ''} has been cancelled. If you have any questions, please contact us. - Timeless Rides`,
}

/**
 * Send a status-change notification to the client via SMS.
 * Fire-and-forget — does not throw on failure.
 */
export async function triggerStatusNotification(
  ride: RideNotificationData,
  newStatus: RideStatus
): Promise<void> {
  const templateFn = MESSAGE_TEMPLATES[newStatus]
  if (!templateFn) return

  const phone = ride.client_phone
  const contactId = ride.client_contact_id
  if (!phone && !contactId) return

  const message = templateFn(ride)

  try {
    await sendSMS({
      contactId: contactId || undefined,
      phone: phone || undefined,
      message,
    })
  } catch (err) {
    console.error(`Failed to send ${newStatus} notification:`, err)
  }
}
