"""Agora token generation service for live proctoring."""
from agora_token_builder import RtcTokenBuilder
import time
from app.config.settings import get_settings

settings = get_settings()

def generate_agora_token(channel_name: str, uid: str, role: str = "publisher") -> dict:
    """
    Generate Agora RTC token for live proctoring.

    Args:
        channel_name: Assessment ID (used as room/channel name)
        uid: User ID (candidate ID or admin ID)
        role: "publisher" (can send/receive) or "subscriber" (receive only)

    Returns:
        dict: {token, appId, channel, uid, expiresAt}
    """
    app_id = settings.agora_app_id
    app_certificate = settings.agora_app_certificate

    if not app_id or not app_certificate:
        raise ValueError("Agora credentials not configured in settings")

    expiration_time_in_seconds = 86400
    current_timestamp = int(time.time())
    privilege_expired_ts = current_timestamp + expiration_time_in_seconds

    # 1 = PUBLISHER, 2 = SUBSCRIBER
    agora_role = 1 if role == "publisher" else 2

    token = RtcTokenBuilder.buildTokenWithAccount(
        app_id,
        app_certificate,
        channel_name,
        uid,
        agora_role,
        privilege_expired_ts
    )

    return {
        "token": token,
        "appId": app_id,
        "channel": channel_name,
        "uid": uid,
        "expiresAt": privilege_expired_ts
    }
