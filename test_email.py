"""Test email sending with SendGrid"""
import os
from dotenv import load_dotenv

load_dotenv("services/design-service/.env")

sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
sendgrid_from_email = os.getenv("SENDGRID_FROM_EMAIL")

print("SendGrid Configuration:")
print(f"API Key: {sendgrid_api_key[:20]}..." if sendgrid_api_key else "Not configured")
print(f"From Email: {sendgrid_from_email}")

if sendgrid_api_key and sendgrid_from_email:
    print("\n✅ SendGrid is configured!")
    print("\nYou can now send test invitations from the analytics page.")
else:
    print("\n❌ SendGrid is NOT configured")
