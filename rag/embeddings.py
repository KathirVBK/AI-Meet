"""
Embeddings module.
Uses HuggingFace sentence-transformers for local, free vector embeddings.
Guarded for low-memory container environments (e.g. Render 512MB RAM).
"""
import os
import logging

logger = logging.getLogger(__name__)

# Lightweight, high-quality model — no GPU required
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_embeddings_instance = None


def is_embeddings_disabled() -> bool:
    if os.getenv("DISABLE_RAG", "false").lower() in ("true", "1", "yes"):
        return True
    if os.getenv("RENDER", "false").lower() in ("true", "1") and os.getenv("ENABLE_RENDER_RAG", "false").lower() not in ("true", "1"):
        return True
    return False


def get_embeddings():
    """
    Return a singleton HuggingFace embeddings instance.
    Downloads the model on first use (cached locally after that).
    Guarded against loading sentence-transformers in 512MB RAM cloud environments.
    """
    if is_embeddings_disabled():
        raise RuntimeError("Embeddings disabled on Render cloud / low-memory environment to prevent OOM crash.")

    global _embeddings_instance
    if _embeddings_instance is None:
        from langchain_community.embeddings import HuggingFaceEmbeddings
        logger.info(f"Loading embedding model: {EMBEDDING_MODEL_NAME}")
        _embeddings_instance = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL_NAME,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        logger.info("Embedding model loaded successfully.")
    return _embeddings_instance
