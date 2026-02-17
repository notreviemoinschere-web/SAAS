"""
Encryption utilities for secure storage of sensitive data like API keys.
Uses Fernet symmetric encryption with keys derived from environment secret.
"""
import os
import base64
import hashlib
from cryptography.fernet import Fernet


def get_encryption_key() -> bytes:
    """Derive a Fernet-compatible key from JWT_SECRET."""
    secret = os.environ.get('JWT_SECRET', 'default-jwt-secret')
    # Derive 32 bytes using SHA256, then base64 encode for Fernet
    key_bytes = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_value(value: str) -> str:
    """Encrypt a string value and return base64-encoded ciphertext."""
    if not value:
        return ""
    f = Fernet(get_encryption_key())
    encrypted = f.encrypt(value.encode())
    return encrypted.decode()


def decrypt_value(encrypted_value: str) -> str:
    """Decrypt a base64-encoded ciphertext and return the original string."""
    if not encrypted_value:
        return ""
    try:
        f = Fernet(get_encryption_key())
        decrypted = f.decrypt(encrypted_value.encode())
        return decrypted.decode()
    except Exception:
        return ""


def mask_key(key: str, visible_chars: int = 8) -> str:
    """Mask an API key showing only the last N characters."""
    if not key or len(key) <= visible_chars:
        return "*" * 8
    return "*" * (len(key) - visible_chars) + key[-visible_chars:]
