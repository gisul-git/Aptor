import { IDemoRequest } from '../models/DemoRequest';

const COMPETENCY_LABELS: Record<string, string> = {
  general: 'General Assessment',
  dsa: 'DSA Competency',
  aiml: 'AI/ML',
  cloud: 'Cloud Architecture',
  devops: 'DevOps & CI/CD',
  data: 'Data Engineering',
  design: 'Design (UI/UX)',
  custom: 'Custom Assessments',
};

const JOB_TITLE_LABELS: Record<string, string> = {
  ceo: 'CEO/Founder',
  vp: 'VP/Director',
  hr: 'HR Manager',
  ld: 'L&D Manager',
  recruiter: 'Recruiter',
  engineer: 'Engineering Manager',
  other: 'Other',
};

export const generateNotificationEmail = (demoRequest: IDemoRequest): { subject: string; html: string; text: string } => {
  const competencies = demoRequest.competencies
    .map((c) => COMPETENCY_LABELS[c] || c)
    .join(', ');

  const jobTitle = JOB_TITLE_LABELS[demoRequest.jobTitle] || demoRequest.jobTitle;

  const subject = `New Demo Request - ${demoRequest.company}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #9DE8B0 0%, #C9F4D4 100%);
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          color: #1E5A3B;
          margin: 0;
          font-size: 24px;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border: 2px solid #C9F4D4;
          border-top: none;
        }
        .info-section {
          margin-bottom: 25px;
        }
        .info-section h2 {
          color: #2D7A52;
          font-size: 18px;
          margin-bottom: 15px;
          border-bottom: 2px solid #C9F4D4;
          padding-bottom: 10px;
        }
        .info-row {
          display: flex;
          margin-bottom: 10px;
          padding: 8px 0;
        }
        .info-label {
          font-weight: bold;
          color: #1E5A3B;
          width: 150px;
          flex-shrink: 0;
        }
        .info-value {
          color: #333;
          flex: 1;
        }
        .competencies {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 5px;
        }
        .competency-tag {
          background: #E8FAF0;
          color: #2D7A52;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        .footer {
          background: #F8FDF9;
          padding: 20px;
          text-align: center;
          border-radius: 0 0 10px 10px;
          border: 2px solid #C9F4D4;
          border-top: none;
          color: #666;
          font-size: 12px;
        }
        .timestamp {
          color: #999;
          font-size: 12px;
          margin-top: 20px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎁 New Demo Request Received</h1>
      </div>
      
      <div class="content">
        <div class="info-section">
          <h2>Contact Information</h2>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${demoRequest.firstName} ${demoRequest.lastName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${demoRequest.email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${demoRequest.phone} ${demoRequest.whatsapp ? '(WhatsApp preferred)' : ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Company:</span>
            <span class="info-value">${demoRequest.company}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Country:</span>
            <span class="info-value">${demoRequest.country}</span>
          </div>
        </div>

        <div class="info-section">
          <h2>Role & Organization</h2>
          <div class="info-row">
            <span class="info-label">Job Title:</span>
            <span class="info-value">${jobTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Company Size:</span>
            <span class="info-value">${demoRequest.companySize} employees</span>
          </div>
        </div>

        <div class="info-section">
          <h2>Interests</h2>
          <div class="info-row">
            <span class="info-label">Competencies:</span>
            <span class="info-value">
              <div class="competencies">
                ${demoRequest.competencies
                  .map((c) => `<span class="competency-tag">${COMPETENCY_LABELS[c] || c}</span>`)
                  .join('')}
              </div>
            </span>
          </div>
        </div>

        <div class="info-section">
          <h2>Preferences</h2>
          <div class="info-row">
            <span class="info-label">Marketing Consent:</span>
            <span class="info-value">${demoRequest.marketingConsent ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>This is an automated notification from the Aaptor Demo Request System.</p>
        <p>Please respond to the requester within 24 hours.</p>
        <div class="timestamp">
          Request submitted: ${new Date(demoRequest.createdAt).toLocaleString()}
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New Demo Request Received
========================

Contact Information:
- Name: ${demoRequest.firstName} ${demoRequest.lastName}
- Email: ${demoRequest.email}
- Phone: ${demoRequest.phone} ${demoRequest.whatsapp ? '(WhatsApp preferred)' : ''}
- Company: ${demoRequest.company}
- Country: ${demoRequest.country}

Role & Organization:
- Job Title: ${jobTitle}
- Company Size: ${demoRequest.companySize} employees

Interests:
- Competencies: ${competencies}

Preferences:
- Marketing Consent: ${demoRequest.marketingConsent ? 'Yes' : 'No'}

---
Request submitted: ${new Date(demoRequest.createdAt).toLocaleString()}
This is an automated notification. Please respond within 24 hours.
  `;

  return { subject, html, text };
};

export const generateConfirmationEmail = (demoRequest: IDemoRequest): { subject: string; html: string; text: string } => {
  const subject = 'Thank You for Requesting a Demo - Aaptor';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #9DE8B0 0%, #C9F4D4 100%);
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          color: #1E5A3B;
          margin: 0;
          font-size: 24px;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border: 2px solid #C9F4D4;
          border-top: none;
        }
        .highlight {
          background: #E8FAF0;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #2D7A52;
        }
        .footer {
          background: #F8FDF9;
          padding: 20px;
          text-align: center;
          border-radius: 0 0 10px 10px;
          border: 2px solid #C9F4D4;
          border-top: none;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>✅ Demo Request Confirmed</h1>
      </div>
      
      <div class="content">
        <p>Hi ${demoRequest.firstName},</p>
        
        <p>Thank you for requesting a demo of Aaptor! We've received your request and our team will reach out to you within 24 hours to schedule your personalized demo.</p>
        
        <div class="highlight">
          <strong>🎁 What's Next?</strong>
          <p>During your demo, you'll receive <strong>free platform credits</strong> to:</p>
          <ul>
            <li>Create custom questions for any competency</li>
            <li>Build and customize assessments</li>
            <li>Take practice tests from the candidate's perspective</li>
            <li>Explore our analytics and reporting dashboards</li>
          </ul>
        </div>
        
        <p>In the meantime, feel free to explore our platform or reach out if you have any questions.</p>
        
        <p>Best regards,<br>The Aaptor Team</p>
      </div>

      <div class="footer">
        <p>This is an automated confirmation email.</p>
        <p>If you have any questions, please contact us at info@aaptor.com</p>
      </div>
    </body>
    </html>
  `;

  const text = `
Thank You for Requesting a Demo - Aaptor
========================================

Hi ${demoRequest.firstName},

Thank you for requesting a demo of Aaptor! We've received your request and our team will reach out to you within 24 hours to schedule your personalized demo.

What's Next?
During your demo, you'll receive free platform credits to:
- Create custom questions for any competency
- Build and customize assessments
- Take practice tests from the candidate's perspective
- Explore our analytics and reporting dashboards

In the meantime, feel free to explore our platform or reach out if you have any questions.

Best regards,
The Aaptor Team

---
This is an automated confirmation email.
If you have any questions, please contact us at info@aaptor.com
  `;

  return { subject, html, text };
};

