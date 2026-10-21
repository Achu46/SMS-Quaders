import { api } from './api';

/**
 * Dispatches an email through the secure backend email service.
 * Never exposes email credentials (SMTP/Resend) to the browser.
 * 
 * @param {Object} options 
 * @param {string} options.to - Recipient email
 * @param {string} [options.templateType] - 'WELCOME', 'FORGOT_PASSWORD', 'APPROVAL', or 'NOTIFICATION'
 * @param {Object} [options.data] - Data payload for template interpolation
 * @param {string} [options.subject] - Custom email subject
 * @param {string} [options.html] - Custom email HTML content
 * @returns {Promise<Object>} - Response from the server
 */
export const sendEmail = async ({ to, templateType, data, subject, html }) => {
  try {
    const res = await api.post('/email/send', {
      to,
      templateType,
      data,
      subject,
      html
    });
    return res;
  } catch (error) {
    console.error('Email dispatch error:', error);
    throw error;
  }
};
