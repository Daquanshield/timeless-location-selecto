import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit, sanitizeString, validateContentType, isRequestTooLarge } from '@/lib/security'
import type { CreateInvoiceRequest, InvoiceResponse, Invoice } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, 'invoice-generate', {
      maxRequests: 30,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    if (!validateContentType(request)) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Invalid request' },
        { status: 400 }
      )
    }

    if (isRequestTooLarge(request.headers.get('content-length'), 50000)) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Request too large' },
        { status: 413 }
      )
    }

    const body: CreateInvoiceRequest = await request.json()

    // Validate required fields
    if (!body.contact_id || !body.contact_name || !body.contact_phone) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Missing required contact fields' },
        { status: 400 }
      )
    }

    if (!body.pickup_address || !body.dropoff_address || !body.trip_date) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Missing required trip fields' },
        { status: 400 }
      )
    }

    if (!body.fare_cents || body.fare_cents <= 0) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Invalid fare amount' },
        { status: 400 }
      )
    }

    const gratuity = body.gratuity_cents || 0
    const extras = body.extras_cents || 0
    const total = body.fare_cents + gratuity + extras

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        ride_id: body.ride_id || null,
        contact_id: body.contact_id,
        contact_name: sanitizeString(body.contact_name, 100),
        contact_email: body.contact_email || null,
        contact_phone: body.contact_phone,
        service_type: body.service_type,
        vehicle_class: body.vehicle_class,
        pickup_address: sanitizeString(body.pickup_address, 300),
        dropoff_address: sanitizeString(body.dropoff_address, 300),
        trip_date: body.trip_date,
        fare_cents: body.fare_cents,
        gratuity_cents: gratuity,
        extras_cents: extras,
        total_cents: total,
        price_breakdown: body.price_breakdown,
        notes: body.notes ? sanitizeString(body.notes, 500) : null,
        status: 'draft',
      })
      .select()
      .single()

    if (error) {
      console.error('Invoice creation error:', error)
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Failed to create invoice' },
        { status: 500 }
      )
    }

    return NextResponse.json<InvoiceResponse>({
      success: true,
      invoice: data as Invoice,
      message: `Invoice ${data.invoice_number} created`,
    })
  } catch (error) {
    console.error('Invoice generate error:', error)
    return NextResponse.json<InvoiceResponse>(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
