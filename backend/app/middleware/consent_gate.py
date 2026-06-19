import logging
from typing import List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

class ConsentRequiredError(Exception):
    """Exception raised when a patient lacks required consent."""
    pass

async def require_active_consent(
    db: AsyncSession,
    patient_id: str,
    consent_types: List[str]
) -> None:
    """
    Checks that the patient has granted and active consents for all specified types.
    Raises ConsentRequiredError if any consent is missing or revoked.
    """
    if not patient_id:
        raise ConsentRequiredError("Patient ID must be provided for consent validation.")
        
    for consent_type in consent_types:
        # Check active consent (granted = true and revoked_at is null)
        query = text("""
            SELECT id FROM public.patient_consent
            WHERE patient_id = :patient_id
              AND consent_type = :consent_type
              AND granted = true
              AND revoked_at IS NULL
            LIMIT 1
        """)
        
        result = await db.execute(query, {
            "patient_id": patient_id,
            "consent_type": consent_type
        })
        
        row = result.fetchone()
        if not row:
            logger.warning(f"[Consent Gate] Patient {patient_id} lacks active consent for type: {consent_type}")
            raise ConsentRequiredError(f"Missing active consent for: {consent_type}")
            
    logger.debug(f"[Consent Gate] Patient {patient_id} has active consent for types: {consent_types}")
