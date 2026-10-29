const nodemailer = require('nodemailer');

const STANDARD_EMAIL_WRAPPER = (content, schoolName = 'Quaders School Management System') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 32px 24px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .content { padding: 36px 32px; color: #334155; line-height: 1.6; font-size: 15px; }
    .content h2 { color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700; }
    .content p { margin: 0 0 16px 0; }
    .btn { display: inline-block; padding: 12px 28px; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; text-decoration: none; border-radius: 10px; margin: 16px 0; }
    .footer { padding: 24px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9; background: #fafafa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${schoolName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${schoolName}. All rights reserved.
    </div>
  </div>
</body>
</html>`;

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
      });
      console.log(`[EMAIL] SMTP Transporter configured for host: ${host}:${port}`);
    } else {
      // In development or when SMTP is unconfigured, create fallback transporter that logs sent emails
      this.transporter = {
        sendMail: async (mailOptions) => {
          console.log('\n----------------------------------------');
          console.log('📧 [DEV EMAIL LOGGER - SMTP NOT CONFIGURED]');
          console.log(`To: ${mailOptions.to}`);
          console.log(`Subject: ${mailOptions.subject}`);
          console.log(`From: ${mailOptions.from}`);
          console.log('Content preview:', (mailOptions.text || mailOptions.html || '').slice(0, 200));
          console.log('----------------------------------------\n');
          return { messageId: `mock_${Date.now()}`, response: '250 OK (Logged locally)' };
        }
      };
      console.log('[EMAIL] No SMTP credentials provided. Running in dev logging mode (no crashes).');
    }
  }

  renderTemplate(templateType, data = {}) {
    const schoolName = data.schoolName || 'Quaders School Management System';

    switch (templateType) {
      case 'WELCOME': {
        const subject = `Welcome to ${schoolName}`;
        const body = `
          <h2>Welcome, ${data.userName || 'Member'}!</h2>
          <p>Your account has been successfully created with the role of <strong>${data.role || 'User'}</strong>.</p>
          <p>You can now log in to the portal using the link below:</p>
          <p style="text-align: center;">
            <a href="${data.loginUrl || '#'}" class="btn">Log In to Portal</a>
          </p>
          <p>If you have any questions, feel free to contact your school administration.</p>
        `;
        return { subject, html: STANDARD_EMAIL_WRAPPER(body, schoolName) };
      }

      case 'FORGOT_PASSWORD': {
        const subject = 'Password Reset Request';
        const body = `
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          <p style="text-align: center;">
            <a href="${data.resetLink || '#'}" class="btn">Reset Password</a>
          </p>
          <p>This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
        `;
        return { subject, html: STANDARD_EMAIL_WRAPPER(body, schoolName) };
      }

      case 'STAFF_INVITE': {
        const subject = `Invitation to Join ${schoolName} Staff Portal`;
        const body = `
          <h2>Welcome, ${data.userName || 'Staff Member'}!</h2>
          <p>An administrator at <strong>${schoolName}</strong> has invited you to set up your staff portal account.</p>
          <p><strong>Employee ID:</strong> ${data.employeeId || 'N/A'}</p>
          <p><strong>Assigned Role:</strong> ${data.roleName || 'Staff'}</p>
          <p>Click the secure link below to set your password and complete your registration:</p>
          <p style="text-align: center;">
            <a href="${data.inviteUrl || '#'}" class="btn">Complete Staff Registration</a>
          </p>
          <p style="color: #64748b; font-size: 13px;">This registration link will expire in 48 hours and can only be used once. If you have questions, please reach out to your school administrator.</p>
        `;
        return { subject, html: STANDARD_EMAIL_WRAPPER(body, schoolName) };
      }

      case 'APPROVAL': {
        const subject = 'Your School Account is Approved!';
        const body = `
          <h2>Congratulations, ${data.schoolName || 'School Admin'}!</h2>
          <p>Your school registration has been approved by the platform administrator.</p>
          <p style="text-align: center;">
            <a href="${data.dashboardLink || '#'}" class="btn">Access Dashboard</a>
          </p>
          <p>You can now complete your academic setup and start onboarding staff and students.</p>
        `;
        return { subject, html: STANDARD_EMAIL_WRAPPER(body, schoolName) };
      }

      case 'NOTIFICATION': {
        const subject = data.title || 'Important Notice';
        const body = `
          <h2>${data.title || 'Notice'}</h2>
          <p>${data.message || ''}</p>
          ${data.actionUrl ? `<p style="text-align: center;"><a href="${data.actionUrl}" class="btn">${data.actionText || 'View Details'}</a></p>` : ''}
        `;
        return { subject, html: STANDARD_EMAIL_WRAPPER(body, schoolName) };
      }

      default:
        throw new Error(`Unknown email template type: ${templateType}`);
    }
  }

  /**
   * Send an email with automatic retries and error tolerance
   */
  async send({ to, templateType, data = {}, customSubject = null, customHtml = null, retries = 2 }) {
    if (!to) throw new Error('Recipient email ("to") is required');

    let subject = customSubject;
    let html = customHtml;

    if (templateType) {
      const rendered = this.renderTemplate(templateType, data);
      subject = subject || rendered.subject;
      html = html || rendered.html;
    }

    if (!subject || !html) {
      throw new Error('Email subject and html content are required');
    }

    const senderEmail = process.env.SMTP_FROM || 'support@quaders.com';
    const mailOptions = {
      from: `"Quaders System" <${senderEmail}>`,
      to,
      subject,
      html
    };

    let attempt = 0;
    while (attempt <= retries) {
      try {
        const result = await this.transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Successfully sent email to ${to} (Subject: "${subject}")`);
        return { success: true, messageId: result.messageId, to, subject };
      } catch (err) {
        attempt++;
        console.warn(`[EMAIL] Attempt ${attempt} failed to send email to ${to}:`, err.message);
        if (attempt > retries) {
          console.error(`[EMAIL] All ${retries + 1} attempts exhausted. Email delivery failed:`, err);
          return { success: false, error: err.message, to, subject };
        }
        // Exponential backoff
        await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
  }
}

const emailService = new EmailService();
module.exports = emailService;
