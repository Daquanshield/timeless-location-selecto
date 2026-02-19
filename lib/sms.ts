const GHL_API_KEY = 'pit-43964b83-eaaf-4d1c-9296-79ca285270d8'
const GHL_API_URL = 'https://services.leadconnectorhq.com/conversations/messages'

// GHL phone numbers for sending SMS from specific numbers
// Elena = dashboard/login messages, Sofia = customer-facing messages (default)
const SENDER_NUMBERS: Record<string, string> = {
  elena: '+12489403262',
  sofia: '+12484407357',
}

type SenderNumber = 'elena' | 'sofia'

interface SendSMSParams {
  contactId?: string
  phone?: string
  message: string
  from?: SenderNumber
}

interface SendEmailParams {
  contactId: string
  subject: string
  html: string
}

/**
 * Send SMS via GoHighLevel Conversations API.
 * Requires either contactId or phone.
 */
export async function sendSMS(params: SendSMSParams): Promise<boolean> {
  try {
    const body: Record<string, string> = {
      type: 'SMS',
      message: params.message,
    }

    if (params.contactId) {
      body.contactId = params.contactId
    } else if (params.phone) {
      body.phone = params.phone
    } else {
      console.error('sendSMS: No contactId or phone provided')
      return false
    }

    // Use specific sender number if requested
    if (params.from && SENDER_NUMBERS[params.from]) {
      body.fromNumber = SENDER_NUMBERS[params.from]
    }

    const response = await fetch(GHL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-04-15',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('sendSMS failed:', response.status, text.substring(0, 200))
      return false
    }

    return true
  } catch (error) {
    console.error('sendSMS error:', error)
    return false
  }
}

/**
 * Send Email via GoHighLevel Conversations API.
 * Requires contactId (GHL needs a contact to send email).
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  try {
    const response = await fetch(GHL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-04-15',
      },
      body: JSON.stringify({
        type: 'Email',
        contactId: params.contactId,
        subject: params.subject,
        html: params.html,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('sendEmail failed:', response.status, text.substring(0, 200))
      return false
    }

    return true
  } catch (error) {
    console.error('sendEmail error:', error)
    return false
  }
}
