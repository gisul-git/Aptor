"""Email service utilities."""
from __future__ import annotations

import logging
from typing import Optional

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from ..core.config import get_settings

logger = logging.getLogger(__name__)


async def send_welcome_email(
    email: str,
    name: str,
    aaptor_id: str,
    temp_password: str,
    organization_name: str,
    setup_link: str,
) -> None:
    """Send welcome email to new employee."""
    settings = get_settings()
    
    # If SendGrid is not configured, just log
    if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
        logger.info(f"Email service not configured. Would send welcome email to {email}")
        logger.info(f"Setup link: {setup_link}")
        logger.info(f"Temporary password: {temp_password}")
        return
    
    try:
        subject = f"Welcome to {organization_name}!"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">Welcome to {organization_name}!</h2>
                <p>Hello {name},</p>
                <p>Your employee account has been created. Here are your credentials:</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Aaptor ID:</strong> {aaptor_id}</p>
                    <p><strong>Email:</strong> {email}</p>
                    <p><strong>Temporary Password:</strong> {temp_password}</p>
                </div>
                <p><strong>Important:</strong> This temporary password will expire in 24 hours.</p>
                <p>Please click the link below to set your permanent password:</p>
                <a href="{setup_link}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Set Your Password</a>
                <p>Or copy this link: {setup_link}</p>
                <p>If you have any questions, please contact your administrator.</p>
            </div>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=settings.sendgrid_from_email,
            to_emails=email,
            subject=subject,
            html_content=html_content,
        )
        
        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)
        
        if response.status_code == 202:
            logger.info(f"Welcome email sent successfully to {email}")
        else:
            logger.error(f"Failed to send email. Status code: {response.status_code}")
    
    except Exception as e:
        logger.error(f"Error sending welcome email to {email}: {e}", exc_info=True)

