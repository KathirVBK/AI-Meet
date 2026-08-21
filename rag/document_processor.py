"""
Document processor for the RAG pipeline.
Splits meeting transcripts and MoM text into chunks with metadata.
"""
import logging
from typing import List, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

# Chunk settings tuned for meeting content
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150


def create_meeting_documents(
    transcript: str,
    mom_text: str,
    club_name: str,
    meeting_date: str,
    meeting_title: Optional[str] = None,
    decisions: Optional[List[dict]] = None,
) -> List[Document]:
    """
    Create LangChain Document chunks from meeting transcript and MoM text.

    Args:
        transcript: Raw/cleaned transcript text.
        mom_text: Generated Minutes of Meeting markdown text.
        club_name: Name of the student club.
        meeting_date: Date of the meeting.
        meeting_title: Optional title for the meeting.
        decisions: Optional list of structured decision dicts.

    Returns:
        List of Document chunks with metadata.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    documents = []

    # Process transcript
    if transcript:
        transcript_chunks = splitter.split_text(transcript)
        for i, chunk in enumerate(transcript_chunks):
            documents.append(Document(
                page_content=chunk,
                metadata={
                    "source": "transcript",
                    "club_name": club_name,
                    "meeting_date": meeting_date,
                    "meeting_title": meeting_title or f"{club_name} Meeting",
                    "chunk_index": i,
                    "total_chunks": len(transcript_chunks),
                },
            ))

    # Process MoM
    if mom_text:
        mom_chunks = splitter.split_text(mom_text)
        for i, chunk in enumerate(mom_chunks):
            documents.append(Document(
                page_content=chunk,
                metadata={
                    "source": "minutes_of_meeting",
                    "club_name": club_name,
                    "meeting_date": meeting_date,
                    "meeting_title": meeting_title or f"{club_name} Meeting",
                    "chunk_index": i,
                    "total_chunks": len(mom_chunks),
                },
            ))

    # Process Decisions
    if decisions:
        for i, d in enumerate(decisions):
            if isinstance(d, dict):
                decision_text = d.get("decision", "")
                status = d.get("status", "Confirmed")
                content = f"Decision made: {decision_text}. Status: {status}."
                if d.get("evidence"):
                    content += f" Evidence: {d['evidence']}"
            else:
                content = f"Decision made: {d}"

            documents.append(Document(
                page_content=content,
                metadata={
                    "source": "decision",
                    "club_name": club_name,
                    "meeting_date": meeting_date,
                    "meeting_title": meeting_title or f"{club_name} Meeting",
                    "decision_index": i,
                },
            ))

    logger.info(
        f"Created {len(documents)} document chunks "
        f"({len(transcript_chunks) if transcript else 0} transcript + "
        f"{len(mom_chunks) if mom_text else 0} MoM)"
    )
    return documents
