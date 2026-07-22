const nodemailer = require('nodemailer');
require('dotenv').config();

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE === 'true' || true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('[MAIL] SMTP Connection Error:', error.message);
  } else {
    console.log('[MAIL] SMTP Connection Successful. Ready to send emails via Hostinger.');
  }
});

// Base HTML Wrapper
const baseTemplate = (content, preheader = '') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FORENSIQ</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background-color: #0a1e3c; padding: 32px 40px; text-align: center; }
    .header-logo { color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; margin: 0; text-decoration: none; }
    .header-logo span { color: #00d1ff; }
    .content { padding: 40px; color: #334155; line-height: 1.6; font-size: 16px; }
    .content h1 { color: #0f172a; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 24px; }
    .content p { margin-top: 0; margin-bottom: 20px; }
    .btn { display: inline-block; background-color: #0a1e3c; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-top: 10px; margin-bottom: 10px; transition: background-color 0.2s; text-align: center; }
    .btn:hover { background-color: #112a52; }
    .footer { background-color: #f1f5f9; padding: 32px 40px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
    .footer a { color: #00d1ff; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .preheader { display: none; max-height: 0px; overflow: hidden; }
    @media only screen and (max-width: 600px) {
      .container { margin: 0; border-radius: 0; width: 100%; box-shadow: none; }
      .content { padding: 30px 20px; }
      .header, .footer { padding: 30px 20px; }
    }
  </style>
</head>
<body>
  <span class="preheader">${preheader}</span>
  <div class="container">
    <div class="header">
      <a href="https://forensiq.in" class="header-logo">FORENSIQ</a>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin-bottom: 12px;">Need help? Contact our support team at <a href="mailto:support@forensiq.in">support@forensiq.in</a></p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} FORENSIQ. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const sendMail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME || 'FORENSIQ'}" <${process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text: text || 'Please view this email in an HTML compatible client.',
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL] SUCCESS: Email sent to ${to}. MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MAIL] ERROR sending to ${to}:`, error.message);
    throw new Error('Failed to send email.');
  }
};

/**
 * Send OTP Email for login/registration
 */
exports.sendOTPEmail = async ({ to, fullName, otp }) => {
  const userName = fullName || 'User';
  const subject = 'Your FORENSIQ Verification Code';
  const preheader = 'Use this code to verify your account.';

  const content = `
    <h1>Verification Code</h1>
    <p>Hi ${userName},</p>
    <p>Please use the verification code below to securely access your FORENSIQ account:</p>
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; text-align: center; margin: 30px 0; border: 1px dashed #cbd5e1;">
      <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0a1e3c;">${otp}</span>
    </div>
    <p>This code will expire in <strong>15 minutes</strong>.</p>
    <p>If you did not request this verification code, please ignore this email or contact support if you have concerns.</p>
    <p style="margin-top: 30px;">Best regards,<br>The FORENSIQ Team</p>
  `;

  return sendMail({
    to,
    subject,
    html: baseTemplate(content, preheader),
    text: `Hi ${userName}, Your verification code is: ${otp}`,
  });
};

/**
 * Send Password Reset Email
 */
exports.sendPasswordResetEmail = async ({ to, fullName, resetData }) => {
  const userName = fullName || 'User';
  const subject = 'Reset Your FORENSIQ Password';
  const preheader = 'Follow the instructions inside to reset your password.';
  
  // resetData could be an OTP or a link. We will handle both or assume OTP for now.
  const isLink = resetData.toString().startsWith('http');

  const content = `
    <h1>Password Reset Request</h1>
    <p>Hi ${userName},</p>
    <p>We received a request to reset the password for your FORENSIQ account.</p>
    
    ${isLink ? `
      <p>Click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetData}" class="btn">Reset Password</a>
      </div>
      <p style="font-size: 14px; color: #64748b;">Or copy and paste this link into your browser: <br><a href="${resetData}" style="color: #00d1ff;">${resetData}</a></p>
    ` : `
      <p>Please use the verification code below to securely reset your password:</p>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; text-align: center; margin: 30px 0; border: 1px dashed #cbd5e1;">
        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0a1e3c;">${resetData}</span>
      </div>
    `}
    
    <p>This request will expire in <strong>15 minutes</strong>.</p>
    <p>If you did not request a password reset, you can safely ignore this email. Your account remains secure.</p>
    <p style="margin-top: 30px;">Best regards,<br>The FORENSIQ Team</p>
  `;

  return sendMail({
    to,
    subject,
    html: baseTemplate(content, preheader),
    text: `Hi ${userName}, to reset your password use this code/link: ${resetData}`,
  });
};

/**
 * Send Welcome Email
 */
exports.sendWelcomeEmail = async ({ to, fullName, role = 'student' }) => {
  const userName = fullName || 'Learner';
  const subject = 'Welcome to FORENSIQ!';
  const preheader = 'We are thrilled to have you on board.';

  const ROLE_MESSAGES = {
    student: 'You can now log in to the Academy dashboard to access courses, quizzes, and resources.',
    client: 'You can log in to CaseDesk to securely submit and track your forensic service requests.',
    institution: 'You can log in to CampusConnect to manage institution programs and workshops.',
    professional: 'You can log in to CaseConnect for professional collaboration and networking.',
    member: 'You can log in to the Network portal for exclusive events and community access.',
    admin: 'You can sign in via the platform administration page.',
  };

  const roleMessage = ROLE_MESSAGES[role.toLowerCase()] || 'You can now log in with your registered email.';

  const content = `
    <h1>Welcome to FORENSIQ!</h1>
    <p>Hi ${userName},</p>
    <p>Your account has been created successfully. We're thrilled to have you join our community.</p>
    <p>${roleMessage}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://forensiq.in/login" class="btn">Log in to your account</a>
    </div>
    <p>If you have any questions or need help getting started, just reply to this email.</p>
    <p style="margin-top: 30px;">Best regards,<br>The FORENSIQ Team</p>
  `;

  return sendMail({
    to,
    subject,
    html: baseTemplate(content, preheader),
    text: `Hi ${userName}, Welcome to FORENSIQ! ${roleMessage}`,
  });
};

/**
 * Send Notification Email
 */
exports.sendNotificationEmail = async ({ to, subject, title, message }) => {
  const preheader = title || 'You have a new notification from FORENSIQ.';

  const content = `
    <h1>${title || 'New Notification'}</h1>
    <p>${message}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://forensiq.in/dashboard" class="btn">View in Dashboard</a>
    </div>
    <p style="margin-top: 30px;">Best regards,<br>The FORENSIQ Team</p>
  `;

  return sendMail({
    to,
    subject,
    html: baseTemplate(content, preheader),
    text: `${title}: ${message}`,
  });
};

/**
 * Send Sub-Admin Credentials Email
 */
exports.sendSubAdminCredentialsEmail = async ({ to, fullName, tempPassword, loginUrl }) => {
  const userName = fullName || 'User';
  const subject = 'Your FORENSIQ Sub-Admin Account Details';
  const preheader = 'Your temporary admin credentials are inside this email.';
  const safeLoginUrl = loginUrl || 'https://forensiq.in/login';

  const content = `
    <h1>Sub-Admin Account Created</h1>
    <p>Hi ${userName},</p>
    <p>Your FORENSIQ sub-admin account has been created. Use the temporary password below to sign in and update it after your first login.</p>
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; text-align: center; margin: 30px 0; border: 1px dashed #cbd5e1;">
      <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">Temporary Password</p>
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 3px; color: #0a1e3c;">${tempPassword}</span>
    </div>
    <p>Sign in here: <a href="${safeLoginUrl}" style="color: #00d1ff;">${safeLoginUrl}</a></p>
    <p>If you were not expecting this account, please contact support immediately.</p>
    <p style="margin-top: 30px;">Best regards,<br>The FORENSIQ Team</p>
  `;

  return sendMail({
    to,
    subject,
    html: baseTemplate(content, preheader),
    text: `Hi ${userName}, your temporary password is: ${tempPassword}. Sign in at ${safeLoginUrl}`,
  });
};

/**
 * Send Order Confirmation Email
 */
exports.orderConfirmationEmail = async ({ to, fullName, details }) => {
  const { courseName, courseDescription, amount, paymentId, orderId } = details;
  const userName = fullName || 'Learner';
  const subject = `Payment Confirmed - ${courseName}`;
  const preheader = 'Your enrollment is active.';

  const amountFormatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(Number(amount) || 0);

  const content = `
    <h1>Payment Successful</h1>
    <p>Hi ${userName},</p>
    <p>Thank you for your purchase. Your payment was successful, and your enrollment for <strong>${courseName}</strong> is now active.</p>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin: 30px 0; border: 1px solid #e2e8f0;">
      <h3 style="margin-top: 0; color: #0a1e3c; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 16px;">Order Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 40%;">Course:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #1f2937;">${courseName}</td>
        </tr>
        ${courseDescription ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Description:</td>
          <td style="padding: 8px 0; color: #1f2937;">${courseDescription}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Amount Paid:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #10b981;">${amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Payment ID:</td>
          <td style="padding: 8px 0; font-family: monospace; color: #475569;">${paymentId || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; border-bottom: none;">Order ID:</td>
          <td style="padding: 8px 0; font-family: monospace; color: #475569; border-bottom: none;">${orderId || 'N/A'}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://forensiq.in/dashboard/courses" class="btn">Start Learning Now</a>
    </div>
    
    <p>Keep this email for your records. If you have any issues accessing your course, please contact support.</p>
    <p style="margin-top: 30px;">Happy Learning,<br>The FORENSIQ Team</p>
  `;

  return sendMail({
    to,
    subject,
    html: baseTemplate(content, preheader),
    text: `Hi ${userName}, your payment for ${courseName} is confirmed. Amount Paid: ${amountFormatted}. Payment ID: ${paymentId}`,
  });
};

/**
 * 6) Payment Received / Enrollment Issue Notification
 * Sent when payment succeeds but enrollment fails due to a system issue.
 */
exports.paymentIssueEmail = async ({ to, fullName, details }) => {
  const { courseName, amount, paymentId, orderId } = details;
  const userName = fullName || 'Student';
  const amountFormatted = amount === 0 ? 'Free' : `₹${amount}`;

  const subject = `Payment Received for ${courseName} - Action Required`;
  const preheader = `We received your payment, but encountered an issue enrolling you.`;

  const content = `
    <h1>Payment Received</h1>
    <p>Hi ${userName},</p>
    <p>We have successfully received your payment of <strong>${amountFormatted}</strong> for <strong>${courseName}</strong>.</p>
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0; color: #991b1b; font-weight: 600;">Action Required</p>
      <p style="margin-top: 8px; margin-bottom: 0; color: #7f1d1d;">Due to a technical glitch, we couldn't automatically add the course to your dashboard. Please reply to this email or contact <a href="mailto:management@forensiq.in" style="color: #dc2626;">management@forensiq.in</a> with your Payment ID, and our team will manually assign the course to your account immediately.</p>
    </div>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
      <h3 style="margin-top: 0; color: #0f172a; margin-bottom: 12px; font-size: 16px;">Payment Details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Course:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${courseName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #e2e8f0;">Amount Paid:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #059669; border-bottom: 1px solid #e2e8f0;">${amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Payment ID:</td>
          <td style="padding: 8px 0; font-family: monospace; color: #475569;">${paymentId || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; border-bottom: none;">Order ID:</td>
          <td style="padding: 8px 0; font-family: monospace; color: #475569; border-bottom: none;">${orderId || 'N/A'}</td>
        </tr>
      </table>
    </div>

    <p style="margin-top: 30px;">We apologize for the inconvenience and will resolve this for you as soon as possible.<br>The FORENSIQ Team</p>
  `;

  return sendMail({
    to,
    subject,
    html: baseTemplate(content, preheader),
    text: `Hi ${userName}, your payment for ${courseName} is confirmed but enrollment failed. Amount Paid: ${amountFormatted}. Payment ID: ${paymentId}. Please contact support.`,
  });
};

