"""
Embeddings module.
Uses HuggingFace sentence-transformers for local, free vector embeddings.
"""
import logging
from langchain_community.embeddings import HuggingFaceEmbeddings

logger = logging.getLogger(__name__)

# Lightweight, high-quality model — no GPU required
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_embeddings_instance = None


def get_embeddings() -> HuggingFaceEmbeddings:
    """
    Return a singleton HuggingFace embeddings instance.
    Downloads the model on first use (cached locally after that).
    """
    global _embeddings_instance
    if _embeddings_instance is None:
        logger.info(f"Loading embedding model: {EMBEDDING_MODEL_NAME}")
        _embeddings_instance = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL_NAME,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        logger.info("Embedding model loaded successfully.")
    return _embeddings_instance
