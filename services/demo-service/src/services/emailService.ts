import { IDemoRequest } from '../models/DemoRequest';
import { sendEmail, isSendGridReady } from '../config/sendgrid';
import {
  generateNotificationEmail,
  generateConfirmationEmail,
} from '../utils/emailTemplates';

const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'info@aaptor.com';

export const sendDemoRequestNotification = async (
  demoRequest: IDemoRequest
): Promise<boolean> => {
  if (!isSendGridReady()) {
    console.warn('[EmailService] SendGrid not ready. Skipping notification email.');
    return false;
  }

  try {
    const { subject, html, text } = generateNotificationEmail(demoRequest);
    const success = await sendEmail(NOTIFICATION_EMAIL, subject, html, text);

    if (success) {
      console.log(`[EmailService] ✅ Notification email sent to ${NOTIFICATION_EMAIL}`);
    } else {
      console.error(`[EmailService] ❌ Failed to send notification email to ${NOTIFICATION_EMAIL}`);
    }

    return success;
  } catch (error) {
    console.error('[EmailService] ❌ Error sending notification email:', error);
    return false;
  }
};

export const sendDemoRequestConfirmation = async (
  demoRequest: IDemoRequest
): Promise<boolean> => {
  if (!isSendGridReady()) {
    console.warn('[EmailService] SendGrid not ready. Skipping confirmation email.');
    return false;
  }

  try {
    const { subject, html, text } = generateConfirmationEmail(demoRequest);
    const success = await sendEmail(demoRequest.email, subject, html, text);

    if (success) {
      console.log(`[EmailService] ✅ Confirmation email sent to ${demoRequest.email}`);
    } else {
      console.error(`[EmailService] ❌ Failed to send confirmation email to ${demoRequest.email}`);
    }

    return success;
  } catch (error) {
    console.error('[EmailService] ❌ Error sending confirmation email:', error);
    return false;
  }
};

