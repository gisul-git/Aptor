"""Email service for sending emails from Super Admin Service."""
from __future__ import annotations

import logging
from typing import Any

from ....config.settings import get_settings

logger = logging.getLogger(__name__)


async def send_acceptance_email(demo_request: dict[str, Any], org_id: str, temp_password: str) -> bool:
    """Send acceptance email with login credentials to demo request requester."""
    try:
        # Simple email message for now
        recipient_email = demo_request.get("email")
        if not recipient_email:
            logger.error("No email found in demo request")
            return False
        
        # Get settings from config
        settings = get_settings()
        sendgrid_api_key = settings.sendgrid_api_key
        sendgrid_from_email = settings.sendgrid_from_email
        sendgrid_from_name = settings.sendgrid_from_name
        
        if not sendgrid_api_key:
            logger.warning("SENDGRID_API_KEY not found. Email sending disabled.")
            return False
        
        # Import requests if available, otherwise log and return False
        try:
            import requests
        except ImportError:
            logger.warning("requests library not available. Install it to enable email sending.")
            return False
        
        # Prepare email content with credentials
        subject = "Welcome to Aaptor - Your Account Credentials"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; background-color: #f9f9f9; }}
                .credentials {{ background-color: #ffffff; border: 2px solid #4F46E5; border-radius: 8px; padding: 20px; margin: 20px 0; }}
                .credential-row {{ margin: 15px 0; }}
                .credential-label {{ font-weight: bold; color: #4F46E5; display: block; margin-bottom: 5px; }}
                .credential-value {{ font-family: monospace; font-size: 16px; background-color: #f3f4f6; padding: 10px; border-radius: 4px; display: block; word-break: break-all; }}
                .warning {{ background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Aaptor!</h1>
                </div>
                <div class="content">
                    <p>Dear {demo_request.get('firstName', '')} {demo_request.get('lastName', '')},</p>
                    <p>Thank you for your interest in Aaptor! We're excited to inform you that your demo request has been accepted and your account has been created.</p>
                    
                    <div class="credentials">
                        <h2 style="color: #4F46E5; margin-top: 0;">Your Login Credentials</h2>
                        
                        <div class="credential-row">
                            <span class="credential-label">Organization ID:</span>
                            <span class="credential-value">{org_id}</span>
                        </div>
                        
                        <div class="credential-row">
                            <span class="credential-label">Email:</span>
                            <span class="credential-value">{recipient_email}</span>
                        </div>
                        
                        <div class="credential-row">
                            <span class="credential-label">Temporary Password:</span>
                            <span class="credential-value">{temp_password}</span>
                        </div>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Important:</strong> This is a temporary password. After logging in, you will be required to reset your password to a secure password of your choice.
                    </div>
                    
                    <p><strong>Next Steps:</strong></p>
                    <ol>
                        <li>Visit the Aaptor login page</li>
                        <li>Enter your Organization ID, Email, and Temporary Password</li>
                        <li>You will be prompted to create a new password</li>
                        <li>Start exploring the platform!</li>
                    </ol>
                    
                    <p>If you have any questions, please don't hesitate to reach out to us.</p>
                    <p>Best regards,<br>The Aaptor Team</p>
                </div>
                <div class="footer">
                    <p>© 2024 Aaptor. All rights reserved.</p>
                    <p>Please keep your credentials secure and do not share them with anyone.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Welcome to Aaptor!
        
        Dear {demo_request.get('firstName', '')} {demo_request.get('lastName', '')},
        
        Thank you for your interest in Aaptor! We're excited to inform you that your demo request has been accepted and your account has been created.
        
        YOUR LOGIN CREDENTIALS:
        =======================
        Organization ID: {org_id}
        Email: {recipient_email}
        Temporary Password: {temp_password}
        
        ⚠️ IMPORTANT: This is a temporary password. After logging in, you will be required to reset your password to a secure password of your choice.
        
        NEXT STEPS:
        1. Visit the Aaptor login page
        2. Enter your Organization ID, Email, and Temporary Password
        3. You will be prompted to create a new password
        4. Start exploring the platform!
        
        If you have any questions, please don't hesitate to reach out to us.
        
        Best regards,
        The Aaptor Team
        
        Please keep your credentials secure and do not share them with anyone.
        """
        
        # Send email via SendGrid API
        url = "https://api.sendgrid.com/v3/mail/send"
        headers = {
            "Authorization": f"Bearer {sendgrid_api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "personalizations": [
                {
                    "to": [{"email": recipient_email}],
                    "subject": subject,
                }
            ],
            "from": {
                "email": sendgrid_from_email,
                "name": sendgrid_from_name,
            },
            "content": [
                {
                    "type": "text/plain",
                    "value": text_content,
                },
                {
                    "type": "text/html",
                    "value": html_content,
                },
            ],
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 202:
            logger.info(f"Acceptance email sent successfully to {recipient_email}")
            return True
        else:
            logger.error(f"Failed to send email. Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending acceptance email: {e}")
        return False


