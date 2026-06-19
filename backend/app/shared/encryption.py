import os
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

def _get_encryption_key() -> str:
    """Gets the encryption key from JWT_SECRET environment variable."""
    key = os.getenv("JWT_SECRET")
    if not key:
        raise ValueError("JWT_SECRET environment variable is not configured for encryption.")
    return key

async def encrypt_phi(db: AsyncSession, plaintext: str) -> bytes:
    """
    Encrypts a plaintext string using database-level pgcrypto wrappers.
    Returns ciphertext as bytes.
    """
    if not plaintext:
        return b""
    
    key = _get_encryption_key()
    
    query = text("SELECT encrypt_phi_field(:plaintext, :key)")
    result = await db.execute(query, {
        "plaintext": plaintext,
        "key": key
    })
    
    row = result.fetchone()
    if row:
        return row[0]
    raise RuntimeError("Failed to encrypt PHI field")

async def decrypt_phi(db: AsyncSession, ciphertext: bytes) -> str:
    """
    Decrypts a ciphertext bytea value using database-level pgcrypto wrappers.
    Returns the original plaintext string.
    """
    if not ciphertext:
        return ""
        
    key = _get_encryption_key()
    
    query = text("SELECT decrypt_phi_field(:ciphertext, :key)")
    result = await db.execute(query, {
        "ciphertext": ciphertext,
        "key": key
    })
    
    row = result.fetchone()
    if row:
        return row[0]
    raise RuntimeError("Failed to decrypt PHI field")
