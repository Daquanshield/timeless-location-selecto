const GHL_API_KEY = 'pit-43964b83-eaaf-4d1c-9296-79ca285270d8'
const GHL_API_URL = 'https://services.leadconnectorhq.com/conversations/messages'

interface SendSMSParams {
  contactId?: string
  phone?: string
  message: string
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
      // GHL can send to raw phone numbers too
      body.phone = params.phone
    } else {
      console.error('sendSMS: No contactId or phone provided')
      return false
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
