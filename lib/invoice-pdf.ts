import type { Invoice } from '@/types'

/**
 * Generate invoice HTML for PDF rendering and email delivery.
 * Uses inline styles for email compatibility.
 */
export function generateInvoiceHTML(invoice: Invoice): string {
  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const tripDate = new Date(invoice.trip_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Detroit',
  })

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#1a1a2e;padding:32px 40px;text-align:center;">
      <h1 style="color:#d4af37;margin:0;font-size:28px;letter-spacing:2px;">TIMELESS RIDES</h1>
      <p style="color:#999;margin:8px 0 0;font-size:13px;letter-spacing:1px;">LUXURY TRANSPORTATION</p>
    </div>

    <!-- Invoice Info -->
    <div style="padding:32px 40px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
        <div>
          <p style="color:#666;font-size:12px;text-transform:uppercase;margin:0 0 4px;">Invoice</p>
          <p style="color:#1a1a2e;font-size:20px;font-weight:700;margin:0;">${invoice.invoice_number}</p>
        </div>
        <div style="text-align:right;">
          <p style="color:#666;font-size:12px;text-transform:uppercase;margin:0 0 4px;">Date</p>
          <p style="color:#1a1a2e;font-size:14px;margin:0;">${tripDate}</p>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">

      <!-- Client Info -->
      <div style="margin-bottom:24px;">
        <p style="color:#666;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Bill To</p>
        <p style="color:#1a1a2e;font-size:16px;font-weight:600;margin:0;">${invoice.contact_name}</p>
        <p style="color:#666;font-size:14px;margin:4px 0 0;">${invoice.contact_phone}</p>
        ${invoice.contact_email ? `<p style="color:#666;font-size:14px;margin:2px 0 0;">${invoice.contact_email}</p>` : ''}
      </div>

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">

      <!-- Trip Details -->
      <div style="margin-bottom:24px;">
        <p style="color:#666;font-size:12px;text-transform:uppercase;margin:0 0 12px;">Trip Details</p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#666;width:100px;">Service</td>
            <td style="padding:6px 0;color:#1a1a2e;font-weight:500;">${formatServiceType(invoice.service_type)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#666;">Vehicle</td>
            <td style="padding:6px 0;color:#1a1a2e;font-weight:500;">${formatVehicleClass(invoice.vehicle_class)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#666;">Pickup</td>
            <td style="padding:6px 0;color:#1a1a2e;">${invoice.pickup_address}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#666;">Drop-off</td>
            <td style="padding:6px 0;color:#1a1a2e;">${invoice.dropoff_address}</td>
          </tr>
        </table>
      </div>

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">

      <!-- Pricing Breakdown -->
      <div style="margin-bottom:24px;">
        <p style="color:#666;font-size:12px;text-transform:uppercase;margin:0 0 12px;">Charges</p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#1a1a2e;">Base fare</td>
            <td style="padding:8px 0;color:#1a1a2e;text-align:right;">${formatCents(invoice.fare_cents)}</td>
          </tr>
          ${invoice.gratuity_cents > 0 ? `
          <tr>
            <td style="padding:8px 0;color:#1a1a2e;">Gratuity</td>
            <td style="padding:8px 0;color:#1a1a2e;text-align:right;">${formatCents(invoice.gratuity_cents)}</td>
          </tr>` : ''}
          ${invoice.extras_cents > 0 ? `
          <tr>
            <td style="padding:8px 0;color:#1a1a2e;">Additional charges</td>
            <td style="padding:8px 0;color:#1a1a2e;text-align:right;">${formatCents(invoice.extras_cents)}</td>
          </tr>` : ''}
          <tr>
            <td colspan="2"><hr style="border:none;border-top:2px solid #1a1a2e;margin:4px 0;"></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#1a1a2e;font-size:18px;font-weight:700;">Total</td>
            <td style="padding:8px 0;color:#d4af37;font-size:18px;font-weight:700;text-align:right;">${formatCents(invoice.total_cents)}</td>
          </tr>
        </table>
      </div>

      ${invoice.notes ? `
      <div style="background:#f8f9fa;padding:16px;border-radius:6px;margin-bottom:24px;">
        <p style="color:#666;font-size:12px;text-transform:uppercase;margin:0 0 4px;">Notes</p>
        <p style="color:#1a1a2e;font-size:14px;margin:0;">${invoice.notes}</p>
      </div>` : ''}
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">Timeless Rides LLC | Detroit, Michigan</p>
      <p style="color:#999;font-size:12px;margin:4px 0 0;">Questions? Call (248) 440-7357 or reply to this message.</p>
      <p style="color:#ccc;font-size:11px;margin:12px 0 0;">Thank you for choosing Timeless Rides.</p>
    </div>
  </div>
</body>
</html>`
}

function formatServiceType(type: string): string {
  const map: Record<string, string> = {
    AIRPORT: 'Airport Transfer',
    HOURLY: 'Hourly Charter',
    DAY_RATE: 'Day Rate',
    LONG_DISTANCE: 'Long Distance',
    MULTI_STOP: 'Multi-Stop',
  }
  return map[type] || type
}

function formatVehicleClass(cls: string): string {
  const map: Record<string, string> = {
    EXECUTIVE_SUV: 'Executive SUV',
    PREMIER_SUV: 'Premier SUV',
  }
  return map[cls] || cls
}

/**
 * Generate a plain-text SMS version of the invoice.
 */
export function generateInvoiceSMS(invoice: Invoice): string {
  const total = `$${(invoice.total_cents / 100).toFixed(2)}`
  const date = new Date(invoice.trip_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Detroit',
  })

  return [
    `Timeless Rides Invoice ${invoice.invoice_number}`,
    ``,
    `${date} | ${formatServiceType(invoice.service_type)}`,
    `${invoice.pickup_address} → ${invoice.dropoff_address}`,
    ``,
    `Total: ${total}`,
    ``,
    `Thank you for riding with us! Questions? Call (248) 440-7357`,
  ].join('\n')
}
