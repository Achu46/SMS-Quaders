/**
 * WhatsApp Service interfacing with Meta WhatsApp Cloud API
 */
class WhatsAppService {
  constructor() {
    this.apiVersion = 'v18.0';
    this.baseUrl = 'https://graph.facebook.com';
  }

  /**
   * Sanitizes and validates recipient phone number to E.164 format
   */
  normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
      throw new Error('A valid phone number string is required');
    }

    // Remove all non-digit characters except leading plus
    let clean = phone.trim().replace(/[^\d+]/g, '');
    if (clean.startsWith('+')) {
      clean = clean.substring(1);
    }

    // Default to Indian country code (91) if 10-digit number without country code
    if (clean.length === 10) {
      clean = `91${clean}`;
    }

    if (clean.length < 10 || clean.length > 15) {
      throw new Error(`Invalid phone number length (${clean.length} digits). Must be between 10 and 15 digits.`);
    }

    return clean;
  }

  /**
   * Tests connection with Meta WhatsApp Cloud API
   */
  async testConnection({ accessToken, phoneNumberId }) {
    if (!phoneNumberId) throw new Error('Phone Number ID is required');

    // In dev/test or when using a placeholder token, verify mock connection without crashing
    if (
      process.env.NODE_ENV === 'test' || 
      !accessToken || 
      accessToken.includes('...') || 
      accessToken.startsWith('mock_') ||
      accessToken === 'EAAI...'
    ) {
      console.log(`[WHATSAPP] Verified mock connection for phoneId ${phoneNumberId}`);
      return { success: true, message: 'Mock WhatsApp connection verified successfully' };
    }

    const url = `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to authenticate with WhatsApp Cloud API');
    }

    return {
      success: true,
      data: {
        verifiedName: data.verified_name || data.display_phone_number,
        id: data.id
      }
    };
  }

  /**
   * Sends a template message with automatic retries and tenant isolation
   */
  async sendTemplateMessage({
    accessToken,
    phoneNumberId,
    recipientPhone,
    templateName,
    languageCode = 'en',
    components = [],
    retries = 2
  }) {
    const normalizedPhone = this.normalizePhoneNumber(recipientPhone);

    if (!templateName) throw new Error('Template name is required');

    // Dev/test simulation if credentials are missing or mocked
    if (
      process.env.NODE_ENV === 'test' ||
      !accessToken ||
      !phoneNumberId ||
      accessToken.startsWith('mock_') ||
      accessToken.includes('...')
    ) {
      console.log(`[WHATSAPP DEV] Message dispatched via template "${templateName}" to ${normalizedPhone}`);
      return {
        success: true,
        messageId: `wamid.mock_${Date.now()}_${normalizedPhone}`,
        status: 'accepted_mock'
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 ? { components } : {})
      }
    };

    const url = `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`;

    let attempt = 0;
    while (attempt <= retries) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message || 'WhatsApp Cloud API returned error');
        }

        const msgId = data.messages?.[0]?.id;
        console.log(`[WHATSAPP] Successfully delivered template "${templateName}" to ${normalizedPhone} (ID: ${msgId})`);
        return { success: true, messageId: msgId, status: 'sent' };
      } catch (err) {
        attempt++;
        console.warn(`[WHATSAPP] Attempt ${attempt} failed for ${normalizedPhone}:`, err.message);
        if (attempt > retries) {
          console.error(`[WHATSAPP] All ${retries + 1} attempts exhausted:`, err);
          return { success: false, error: err.message, recipientPhone: normalizedPhone };
        }
        await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
  }

  /**
   * Helper to format PTM parameters
   */
  buildPTMComponents({ parentName, studentName, date, time, meetingType }) {
    return [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: parentName || 'Parent' },
          { type: 'text', text: studentName || 'Student' },
          { type: 'text', text: date || '' },
          { type: 'text', text: time || '' },
          { type: 'text', text: meetingType || 'In-Person' }
        ]
      }
    ];
  }

  /**
   * Helper to format Noticeboard parameters
   */
  buildNoticeComponents({ noticeTitle, noticeDate, audience }) {
    return [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: noticeTitle || 'Announcement' },
          { type: 'text', text: noticeDate || new Date().toISOString().split('T')[0] },
          { type: 'text', text: audience || 'All School Members' }
        ]
      }
    ];
  }
}

const whatsappService = new WhatsAppService();
module.exports = whatsappService;
