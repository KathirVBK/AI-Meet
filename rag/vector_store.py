"""
Vector store module.
Manages the ChromaDB persistent store for meeting knowledge base.
Includes helpers for browsing and managing stored meetings.
"""
import os
import logging
from typing import List, Optional
from collections import defaultdict
from langchain_community.vectorstores import Chroma
from rag.embeddings import get_embeddings

logger = logging.getLogger(__name__)

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
COLLECTION_NAME = "meeting_minutes"

_vector_store_instance = None


def is_rag_disabled() -> bool:
    """
    Returns True if RAG vector store should be bypassed (e.g. on Render Free Tier 512MB RAM
    or when DISABLE_RAG=true is set) to prevent Out-Of-Memory (OOM) SIGKILL crashes.
    """
    if os.getenv("DISABLE_RAG", "false").lower() in ("true", "1", "yes"):
        return True
    if os.getenv("RENDER", "false").lower() in ("true", "1") and os.getenv("ENABLE_RENDER_RAG", "false").lower() not in ("true", "1"):
        return True
    return False


def get_vector_store() -> Optional[Chroma]:
    """
    Return a singleton Chroma vector store instance.
    Loads or creates the persistent ChromaDB collection.
    Returns None if running in low-memory cloud mode to prevent OOM.
    """
    if is_rag_disabled():
        logger.info("ChromaDB vector store disabled in low-memory / Render cloud environment.")
        return None

    global _vector_store_instance
    if _vector_store_instance is None:
        logger.info(f"Initializing ChromaDB at: {CHROMA_DB_PATH}")
        _vector_store_instance = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=get_embeddings(),
            persist_directory=CHROMA_DB_PATH,
        )
        logger.info("ChromaDB vector store ready.")
    return _vector_store_instance


def add_documents_to_store(documents: list) -> int:
    """
    Add a list of LangChain Document objects to the vector store.
    Safely bypasses in low-memory environments.

    Returns:
        Number of documents added.
    """
    if is_rag_disabled():
        logger.info("Bypassing ChromaDB indexing for %d chunks (low-memory cloud mode).", len(documents))
        return len(documents)

    store = get_vector_store()
    if store is None:
        return 0
    store.add_documents(documents)
    logger.info(f"Added {len(documents)} document chunks to ChromaDB.")
    return len(documents)


def get_collection_count() -> int:
    """Return the number of documents in the collection."""
    if is_rag_disabled():
        return 0
    try:
        store = get_vector_store()
        return store._collection.count() if store else 0
    except Exception:
        return 0


def list_stored_meetings() -> List[dict]:
    """
    Return a summary of unique meetings stored in ChromaDB.
    Each entry: {club_name, meeting_date, meeting_title, source_types, chunk_count}
    """
    try:
        store = get_vector_store()
        collection = store._collection
        total = collection.count()
        if total == 0:
            return []

        # Fetch all metadata (ChromaDB get with no filter)
        result = collection.get(include=["metadatas"])
        metadatas = result.get("metadatas", [])

        # Group by (club_name, meeting_date)
        groups = defaultdict(lambda: {
            "chunk_count": 0,
            "source_types": set(),
            "meeting_title": "Meeting",
        })

        for meta in metadatas:
            key = (meta.get("club_name", "Unknown"), meta.get("meeting_date", "Unknown"))
            groups[key]["chunk_count"] += 1
            groups[key]["source_types"].add(meta.get("source", "unknown"))
            if meta.get("meeting_title"):
                groups[key]["meeting_title"] = meta["meeting_title"]

        meetings = []
        for (club, date), info in sorted(groups.items(), key=lambda x: x[1]["chunk_count"], reverse=True):
            meetings.append({
                "club_name": club,
                "meeting_date": date,
                "meeting_title": info["meeting_title"],
                "source_types": list(info["source_types"]),
                "chunk_count": info["chunk_count"],
            })

        return meetings

    except Exception as e:
        logger.error(f"Error listing stored meetings: {e}")
        return []


def delete_meeting_documents(club_name: str, meeting_date: str) -> int:
    """
    Delete all document chunks for a specific meeting.

    Returns:
        Number of chunks deleted.
    """
    try:
        store = get_vector_store()
        collection = store._collection
        total_before = collection.count()

        # Get IDs matching the filter
        result = collection.get(
            where={"$and": [
                {"club_name": {"$eq": club_name}},
                {"meeting_date": {"$eq": meeting_date}},
            ]},
            include=[],
        )
        ids_to_delete = result.get("ids", [])

        if ids_to_delete:
            collection.delete(ids=ids_to_delete)
            logger.info(f"Deleted {len(ids_to_delete)} chunks for {club_name} — {meeting_date}")

        return len(ids_to_delete)

    except Exception as e:
        logger.error(f"Error deleting meeting documents: {e}")
        return 0


def reset_vector_store():
    """Delete and recreate the vector store (use with caution)."""
    global _vector_store_instance
    store = get_vector_store()
    store.delete_collection()
    _vector_store_instance = None
    logger.warning("Vector store collection deleted and reset.")
