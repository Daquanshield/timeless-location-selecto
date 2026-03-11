import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit, validateContentType } from '@/lib/security'
import { sendSMS, sendEmail } from '@/lib/sms'
import { generateInvoiceHTML, generateInvoiceSMS } from '@/lib/invoice-pdf'
import type { Invoice, InvoiceResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, 'invoice-send', {
      maxRequests: 20,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    if (!validateContentType(request)) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Invalid request' },
        { status: 400 }
      )
    }

    const { invoice_id } = await request.json()

    if (!invoice_id) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Missing invoice_id' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single()

    if (error || !invoice) {
      return NextResponse.json<InvoiceResponse>(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      )
    }

    const inv = invoice as Invoice

    // Send SMS
    const smsText = generateInvoiceSMS(inv)
    const smsSent = await sendSMS({
      contactId: inv.contact_id,
      phone: inv.contact_phone,
      message: smsText,
      from: 'sofia',
    })

    // Send Email (if email available)
    let emailSent = false
    if (inv.contact_email) {
      const html = generateInvoiceHTML(inv)
      emailSent = await sendEmail({
        contactId: inv.contact_id,
        subject: `Timeless Rides Invoice ${inv.invoice_number}`,
        html,
      })
    }

    // Update invoice status
    await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', invoice_id)

    return NextResponse.json<InvoiceResponse>({
      success: true,
      invoice: { ...inv, status: 'sent', sent_at: new Date().toISOString() },
      message: `Invoice sent${smsSent ? ' via SMS' : ''}${emailSent ? ' and email' : ''}`,
    })
  } catch (error) {
    console.error('Invoice send error:', error)
    return NextResponse.json<InvoiceResponse>(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
