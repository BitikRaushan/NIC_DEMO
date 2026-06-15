"""
Symmetric encryption for stored DB credentials.
Uses Fernet (AES-128 in CBC + HMAC) keyed by CREDS_ENC_KEY.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from config import Config


def _build_key() -> bytes:
    raw = Config.CREDS_ENC_KEY.encode("utf-8")
    digest = hashlib.sha256(raw).digest()  # 32 bytes
    return base64.urlsafe_b64encode(digest)


_fernet = Fernet(_build_key())


def encrypt(plain: str) -> str:
    if plain is None:
        return ""
    return _fernet.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""
