import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@aaptor.com';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Aaptor Platform';

let isInitialized = false;

export const initializeSendGrid = (): void => {
  if (!SENDGRID_API_KEY) {
    console.warn('[SendGrid] ⚠️ SENDGRID_API_KEY not found in environment variables');
    console.warn('[SendGrid] Email functionality will be disabled');
    return;
  }

  try {
    sgMail.setApiKey(SENDGRID_API_KEY);
    isInitialized = true;
    console.log('[SendGrid] ✅ SendGrid initialized successfully');
    console.log(`[SendGrid] From Email: ${SENDGRID_FROM_EMAIL}`);
    console.log(`[SendGrid] From Name: ${SENDGRID_FROM_NAME}`);
  } catch (error) {
    console.error('[SendGrid] ❌ Failed to initialize SendGrid:', error);
    isInitialized = false;
  }
};

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> => {
  if (!isInitialized) {
    console.error('[SendGrid] ❌ SendGrid not initialized. Cannot send email.');
    return false;
  }

  try {
    const msg = {
      to,
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME,
      },
      subject,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
      html,
    };

    await sgMail.send(msg);
    console.log(`[SendGrid] ✅ Email sent successfully to ${to}`);
    return true;
  } catch (error: any) {
    console.error('[SendGrid] ❌ Failed to send email:', error);
    if (error.response) {
      console.error('[SendGrid] Error details:', error.response.body);
    }
    return false;
  }
};

export const isSendGridReady = (): boolean => {
  return isInitialized;
};

export const getSendGridConfig = () => {
  return {
    fromEmail: SENDGRID_FROM_EMAIL,
    fromName: SENDGRID_FROM_NAME,
    isInitialized,
  };
};

