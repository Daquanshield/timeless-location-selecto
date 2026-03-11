import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/security'
import type { Invoice, InvoiceResponse } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResponse = rateLimit(request, 'invoice-get', {
      maxRequests: 60,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      )
    }

    return NextResponse.json<InvoiceResponse>({
      success: true,
      invoice: data as Invoice,
    })
  } catch (error) {
    console.error('Invoice fetch error:', error)
    return NextResponse.json<InvoiceResponse>(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update invoice (e.g., mark as paid)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResponse = rateLimit(request, 'invoice-update', {
      maxRequests: 30,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const allowedFields = ['status', 'paid_at', 'notes', 'gratuity_cents', 'extras_cents']
    const updates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    // Recalculate total if gratuity or extras changed
    if (updates.gratuity_cents !== undefined || updates.extras_cents !== undefined) {
      const supabase = createServerClient()
      const { data: existing } = await supabase
        .from('invoices')
        .select('fare_cents, gratuity_cents, extras_cents')
        .eq('id', params.id)
        .single()

      if (existing) {
        const fare = existing.fare_cents
        const gratuity = (updates.gratuity_cents as number) ?? existing.gratuity_cents
        const extras = (updates.extras_cents as number) ?? existing.extras_cents
        updates.total_cents = fare + gratuity + extras
      }
    }

    if (updates.status === 'paid' && !updates.paid_at) {
      updates.paid_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Failed to update invoice' },
        { status: 500 }
      )
    }

    return NextResponse.json<InvoiceResponse>({
      success: true,
      invoice: data as Invoice,
      message: 'Invoice updated',
    })
  } catch (error) {
    console.error('Invoice update error:', error)
    return NextResponse.json<InvoiceResponse>(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
