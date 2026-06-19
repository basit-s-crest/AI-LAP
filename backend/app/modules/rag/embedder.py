import logging

logger = logging.getLogger(__name__)

_embedding_model = None

def get_embedding(text_str: str) -> list[float]:
    """Lazy loads the SentenceTransformer model and computes vector embedding."""
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("[RAG Embedder] Loading BAAI/bge-small-en-v1.5 embedding model...")
        _embedding_model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    # Generate embedding
    emb = _embedding_model.encode(text_str)
    return emb.tolist()
