import logging
import asyncio
from functools import partial

logger = logging.getLogger(__name__)

_embedding_model = None

def _load_and_encode(text_str: str) -> list[float]:
    """Synchronous: lazy-loads the model and computes the embedding."""
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("[RAG Embedder] Loading BAAI/bge-small-en-v1.5 embedding model...")
        _embedding_model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    emb = _embedding_model.encode(text_str)
    return emb.tolist()


def get_embedding(text_str: str) -> list[float]:
    """
    Synchronous wrapper — kept for callers that run outside an event loop
    (e.g. memory_tasks.py extract_significant_events which already runs in its own thread).
    """
    return _load_and_encode(text_str)


async def get_embedding_async(text_str: str) -> list[float]:
    """
    Async wrapper: offloads the blocking SentenceTransformer encode call to the
    default thread-pool executor so it never blocks the asyncio event loop.
    Use this everywhere inside async code.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_load_and_encode, text_str))
