"""
Retriever module for the RAG pipeline.
Wraps ChromaDB similarity search with configurable top-k results.
"""
import logging
from typing import List, Optional
from langchain_core.documents import Document
from rag.vector_store import get_vector_store

logger = logging.getLogger(__name__)

DEFAULT_TOP_K = 5


def retrieve_relevant_docs(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    filter_club: Optional[str] = None,
) -> List[Document]:
    """
    Retrieve the most relevant document chunks from ChromaDB.

    Args:
        query: User's question or search query.
        top_k: Number of top results to return.
        filter_club: Optional club name filter for scoped retrieval.

    Returns:
        List of relevant Document objects.
    """
    store = get_vector_store()

    search_kwargs = {"k": top_k}
    if filter_club:
        search_kwargs["filter"] = {"club_name": filter_club}

    try:
        docs = store.similarity_search(query, **search_kwargs)
        logger.info(f"Retrieved {len(docs)} relevant documents for query: '{query[:60]}...'")
        return docs
    except Exception as e:
        logger.error(f"Retrieval failed: {e}")
        return []


def format_retrieved_context(docs: List[Document]) -> str:
    """
    Format retrieved documents into a structured context string for the LLM.

    Args:
        docs: List of retrieved Document objects.

    Returns:
        Formatted context string.
    """
    if not docs:
        return "No relevant meeting records found."

    context_parts = []
    for i, doc in enumerate(docs, 1):
        meta = doc.metadata
        source_label = "Meeting Minutes" if meta.get("source") == "minutes_of_meeting" else "Transcript"
        context_parts.append(
            f"[Source {i} — {source_label} | {meta.get('club_name', 'Club')} | {meta.get('meeting_date', 'N/A')}]\n"
            f"{doc.page_content}"
        )

    return "\n\n---\n\n".join(context_parts)
