from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, Optional

import boto3
from anyio import to_thread
from azure.communication.email import EmailClient
from botocore.exceptions import BotoCoreError, ClientError
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from python_http_client.exceptions import HTTPError

from ..core.config import get_settings

logger = logging.getLogger(__name__)


class EmailService(ABC):
    """Abstract base class for email services."""

    @abstractmethod
    async def send_email(self, to_address: str, subject: str, html_body: str) -> None:
        """Send an email to the specified address."""
        pass


class AzureEmailService(EmailService):
    """Email service using Azure Communication Services."""

    def __init__(self):
        self._client: EmailClient | None = None
        self._client_initialized: bool = False

    def _get_client(self) -> Optional[EmailClient]:
        if self._client_initialized:
            return self._client

        settings = get_settings()
        if not settings.azure_comm_connection_string or not settings.azure_comm_sender_address:
            logger.warning("Azure Communication Services credentials are not fully configured; email sending disabled")
            self._client_initialized = True
            self._client = None
            return None

        try:
            self._client = EmailClient.from_connection_string(settings.azure_comm_connection_string)
            self._client_initialized = True
            return self._client
        except Exception as exc:
            logger.error("Failed to initialize Azure Email Client: %s", exc)
            self._client_initialized = True
            self._client = None
            return None

    async def send_email(self, to_address: str, subject: str, html_body: str) -> None:
        client = self._get_client()
        if client is None:
            logger.info("Skipping email send to %s because Azure Communication Services is not configured", to_address)
            return

        settings = get_settings()

        message = {
            "content": {
                "subject": subject,
                "html": html_body,
            },
            "recipients": {
                "to": [{"address": to_address}],
            },
            "senderAddress": settings.azure_comm_sender_address,
        }

        def _send_blocking() -> None:
            poller = client.begin_send(message)
            poller.result()

        try:
            await to_thread.run_sync(_send_blocking)
            logger.info("Email sent successfully to %s via Azure Communication Services", to_address)
        except Exception as exc:
            logger.error("Failed to send email via Azure Communication Services: %s", exc)


class SendGridEmailService(EmailService):
    """Email service using SendGrid."""

    def __init__(self):
        self._client: SendGridAPIClient | None = None
        self._client_initialized: bool = False

    def _get_client(self) -> Optional[SendGridAPIClient]:
        if self._client_initialized:
            return self._client

        settings = get_settings()
        if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
            logger.warning("SendGrid credentials are not fully configured; email sending disabled")
            self._client_initialized = True
            self._client = None
            return None

        try:
            self._client = SendGridAPIClient(settings.sendgrid_api_key)
            self._client_initialized = True
            return self._client
        except Exception as exc:
            logger.error("Failed to initialize SendGrid client: %s", exc)
            self._client_initialized = True
            self._client = None
            return None

    async def send_email(self, to_address: str, subject: str, html_body: str) -> None:
        client = self._get_client()
        if client is None:
            error_msg = f"SendGrid is not configured. Cannot send email to {to_address}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        settings = get_settings()
        
        if not settings.sendgrid_from_email:
            error_msg = "SENDGRID_FROM_EMAIL is not configured"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        def _send_blocking() -> None:
            try:
                message = Mail(
                    from_email=(settings.sendgrid_from_email, settings.sendgrid_from_name or "AI Assessment Platform"),
                    to_emails=to_address,
                    subject=subject,
                    html_content=html_body,
                )
                response = client.send(message)
                # Log response for debugging
                logger.info(f"SendGrid response for {to_address}: status_code={response.status_code}, headers={dict(response.headers) if hasattr(response, 'headers') else 'N/A'}")
                
                # Check if response indicates an error
                if hasattr(response, 'status_code') and response.status_code >= 400:
                    error_msg = f"SendGrid returned error status {response.status_code}"
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)
                    
            except Exception as send_exc:
                logger.error(f"Error in SendGrid send_blocking for {to_address}: {send_exc}", exc_info=True)
                raise

        try:
            await to_thread.run_sync(_send_blocking)
            logger.info("Email sent successfully to %s via SendGrid", to_address)
        except HTTPError as exc:
            error_msg = f"HTTP error sending email via SendGrid to {to_address}: {exc}"
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from exc
        except Exception as exc:
            error_msg = f"Failed to send email via SendGrid to {to_address}: {exc}"
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from exc


class AWSEmailService(EmailService):
    """Email service using AWS SES."""

    def __init__(self):
        self._ses_client: Any | None = None
        self._client_initialized: bool = False

    def _get_ses_client(self) -> Optional[Any]:
        if self._client_initialized:
            return self._ses_client

        settings = get_settings()
        if not settings.aws_region or not settings.aws_email_source or not settings.aws_access_key or not settings.aws_secret_key:
            logger.warning("AWS SES credentials are not fully configured; email sending disabled")
            self._client_initialized = True
            self._ses_client = None
            return None

        self._ses_client = boto3.client(
            "ses",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key,
            aws_secret_access_key=settings.aws_secret_key,
        )
        self._client_initialized = True
        return self._ses_client

    async def send_email(self, to_address: str, subject: str, html_body: str) -> None:
        client = self._get_ses_client()
        if client is None:
            logger.info("Skipping email send to %s because SES is not configured", to_address)
            return

        settings = get_settings()
        params = {
            "Destination": {"ToAddresses": [to_address]},
            "Message": {
                "Body": {"Html": {"Charset": "UTF-8", "Data": html_body}},
                "Subject": {"Charset": "UTF-8", "Data": subject},
            },
            "Source": settings.aws_email_source,
        }

        def _send_blocking() -> None:
            client.send_email(**params)

        try:
            await to_thread.run_sync(_send_blocking)
            logger.info("Email sent successfully to %s via AWS SES", to_address)
        except (BotoCoreError, ClientError) as exc:
            logger.error("Failed to send email via SES: %s", exc)


# Factory function to get the appropriate email service
_email_service: EmailService | None = None


def get_email_service() -> EmailService:
    """Get the configured email service instance."""
    global _email_service
    if _email_service is not None:
        return _email_service

    settings = get_settings()
    provider = settings.email_provider.lower()

    if provider == "sendgrid":
        _email_service = SendGridEmailService()
    elif provider == "azure":
        _email_service = AzureEmailService()
    elif provider == "aws":
        _email_service = AWSEmailService()
    else:
        logger.warning("Unknown email provider '%s', defaulting to SendGrid", provider)
        _email_service = SendGridEmailService()

    return _email_service


# Backward compatibility function
async def send_email(to_address: str, subject: str, html_body: str) -> None:
    """Send an email using the configured email service."""
    service = get_email_service()
    await service.send_email(to_address, subject, html_body)


async def send_mfa_otp_email(to_email: str, name: str, otp_code: str) -> None:
    """Send MFA OTP verification code email."""
    subject = "Your Aaptor Verification Code"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Code</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px; text-align: center;">
                                <h1 style="margin: 0; color: #1f2937; font-size: 28px; font-weight: 600;">Verification Code</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 0 40px 40px 40px;">
                                <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
                                    Hi {name},
                                </p>
                                <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
                                    You requested a verification code to sign in to your Aaptor account. Use the code below to complete your sign-in:
                                </p>
                                
                                <!-- OTP Code Box -->
                                <div style="background-color: #f3f4f6; border: 2px solid #e5e7eb; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                                    <div style="font-size: 36px; font-weight: bold; color: #1f2937; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                        {otp_code}
                                    </div>
                                </div>
                                
                                <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
                                    This code will expire in <strong>10 minutes</strong>.
                                </p>
                                
                                <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
                                    If you didn't request this code, please ignore this email or contact support if you have concerns.
                                </p>
                                
                                <!-- Security Notice -->
                                <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
                                    <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                                        <strong>Security Notice:</strong> Never share this code with anyone. Aaptor will never ask you for this code.
                                    </p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 20px;">
                                    Best regards,<br>
                                    The Aaptor Team
                                </p>
                                <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 18px;">
                                    This is an automated email. Please do not reply to this message.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    service = get_email_service()
    await service.send_email(to_email, subject, html_body)

