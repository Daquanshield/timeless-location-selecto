// ============================================
// Dashboard Types
// ============================================

export type UserRole = 'driver' | 'dispatcher'

export type RideStatus =
  | 'pending'
  | 'confirmed'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type ConfirmationStatus =
  | 'unconfirmed'
  | 'confirmed'
  | 'declined'
  | 'unavailable'

export interface DashboardUser {
  id: string
  phone: string
  name: string
  email: string | null
  role: UserRole
  ghl_contact_id: string | null
  is_active: boolean
}

export interface DashboardSession {
  id: string
  user_id: string
  token: string
  expires_at: string
}

export interface RideSummary {
  id: string
  trip_id: string
  driver_name: string | null
  driver_phone: string | null
  client_name: string | null
  client_phone: string | null
  pickup_datetime: string
  pickup_address: string
  dropoff_address: string
  vehicle_type: string | null
  service_option: string | null
  total_amount: number | null
  status: RideStatus
  confirmation_status: ConfirmationStatus
  payment_status: string | null
  is_vip: boolean
  number_of_passengers: number | null
}

export interface RideDetail extends RideSummary {
  driver_email: string | null
  driver_contact_id: string | null
  client_email: string | null
  client_contact_id: string | null
  pickup_zone: string | null
  dropoff_zone: string | null
  service_class: string | null
  distance: string | null
  duration: string | null
  add_ons: string | null
  invoice_id: string | null
  appointment_id: string | null
  notes: string | null
  tags: string[] | null
  assignment_history: AssignmentHistoryEntry[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AssignmentHistoryEntry {
  from_driver: string | null
  to_driver: string
  assigned_by: string
  timestamp: string
  reason?: string
}

export interface DashboardStats {
  rides_today: number
  rides_upcoming: number
  rides_completed_today: number
  total_earnings_today: number
  unconfirmed_count: number
  projected_earnings: number
  payment_breakdown: {
    paid: number
    deposit: number
    unpaid: number
  }
}

// Valid status transitions
export const STATUS_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['en_route', 'cancelled'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'no_show', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
}

// Reverse transitions for undo (go back one step)
export const STATUS_UNDO_TRANSITIONS: Partial<Record<RideStatus, RideStatus>> = {
  en_route: 'confirmed',
  arrived: 'en_route',
  in_progress: 'arrived',
}

// Labels for status action buttons on ride cards
export const STATUS_ACTION_LABELS: Partial<Record<RideStatus, { nextStatus: RideStatus; label: string }>> = {
  confirmed: { nextStatus: 'en_route', label: 'Start En Route' },
  en_route: { nextStatus: 'arrived', label: "I've Arrived" },
  arrived: { nextStatus: 'in_progress', label: 'Passenger Picked Up' },
  in_progress: { nextStatus: 'completed', label: 'Complete Ride' },
}

// Status display config
export const STATUS_CONFIG: Record<RideStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-gray-300', bg: 'bg-gray-600' },
  confirmed: { label: 'Confirmed', color: 'text-blue-200', bg: 'bg-blue-600' },
  en_route: { label: 'En Route', color: 'text-amber-200', bg: 'bg-amber-600' },
  arrived: { label: 'Arrived', color: 'text-purple-200', bg: 'bg-purple-600' },
  in_progress: { label: 'In Progress', color: 'text-green-200', bg: 'bg-green-600' },
  completed: { label: 'Completed', color: 'text-yellow-900', bg: 'bg-yellow-500' },
  cancelled: { label: 'Cancelled', color: 'text-red-200', bg: 'bg-red-600' },
  no_show: { label: 'No Show', color: 'text-orange-200', bg: 'bg-orange-600' },
}

export const CONFIRMATION_CONFIG: Record<ConfirmationStatus, { label: string; color: string; bg: string }> = {
  unconfirmed: { label: 'Needs Response', color: 'text-orange-200', bg: 'bg-orange-600' },
  confirmed: { label: 'Accepted', color: 'text-green-200', bg: 'bg-green-600' },
  declined: { label: 'Declined', color: 'text-red-200', bg: 'bg-red-600' },
  unavailable: { label: 'Unavailable', color: 'text-gray-300', bg: 'bg-gray-600' },
}

export interface StatusLogEntry {
  id: string
  ride_id: string
  status: string
  changed_by: string | null
  changed_by_name: string | null
  timestamp: string
}
