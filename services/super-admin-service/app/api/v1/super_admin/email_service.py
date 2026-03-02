"""Email service for sending emails from Super Admin Service."""
from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


async def send_acceptance_email(demo_request: dict[str, Any]) -> bool:
    """Send acceptance email to demo request requester."""
    try:
        # Simple email message for now
        recipient_email = demo_request.get("email")
        if not recipient_email:
            logger.error("No email found in demo request")
            return False
        
        # For now, we'll use SendGrid via HTTP API or create a simple implementation
        # Since we don't have SendGrid Python SDK in requirements, let's use requests
        sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
        sendgrid_from_email = os.getenv("SENDGRID_FROM_EMAIL", "noreply@aaptor.com")
        sendgrid_from_name = os.getenv("SENDGRID_FROM_NAME", "Aaptor Platform")
        
        if not sendgrid_api_key:
            logger.warning("SENDGRID_API_KEY not found. Email sending disabled.")
            return False
        
        # Import requests if available, otherwise log and return False
        try:
            import requests
        except ImportError:
            logger.warning("requests library not available. Install it to enable email sending.")
            return False
        
        # Prepare email content
        subject = "Your Demo Request Has Been Accepted - Aaptor"
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
                .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Demo Request Accepted</h1>
                </div>
                <div class="content">
                    <p>Dear {demo_request.get('firstName', '')} {demo_request.get('lastName', '')},</p>
                    <p>Thank you for your interest in Aaptor! We're excited to inform you that your demo request has been accepted.</p>
                    <p>Our team will be in touch with you shortly to schedule your demo session.</p>
                    <p>If you have any questions in the meantime, please don't hesitate to reach out to us.</p>
                    <p>Best regards,<br>The Aaptor Team</p>
                </div>
                <div class="footer">
                    <p>© 2024 Aaptor. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Dear {demo_request.get('firstName', '')} {demo_request.get('lastName', '')},
        
        Thank you for your interest in Aaptor! We're excited to inform you that your demo request has been accepted.
        
        Our team will be in touch with you shortly to schedule your demo session.
        
        If you have any questions in the meantime, please don't hesitate to reach out to us.
        
        Best regards,
        The Aaptor Team
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


