"""
LangGraph state definition.
Defines the TypedDict state shared across all agent nodes in the workflow.
Extended to carry speaker-aware transcript structures so that agents can
implement the intelligent task assignment rules (self-assign / named person /
request-then-accept).
"""
from typing import List, Optional, Any, Dict
from typing_extensions import TypedDict


class GraphState(TypedDict, total=False):
    """
    Shared state passed through the LangGraph workflow.
    Each node reads and updates this state. `total=False` so that older
    callers that don't populate the new speaker fields still work.
    """
    # Input / transcript fields
    transcript: str                # Raw plain-text transcript (backward compat)
    labelled_transcript: str       # Speaker-aware "Name:\n text" transcript
    transcript_segments: List[Dict[str, Any]]  # Structured speaker turns
    participants: List[str]        # Resolved participant names
    speaker_mapping: Dict[str, str]  # Speaker 1 -> Kathir
    club_name: str
    meeting_date: str

    # Intermediate processing fields
    analysis: dict
    extracted_action_items: List[dict]
    validation_errors: List[dict]
    validation_attempts: int

    # Output fields
    mom: str                       # Final MoM as markdown string
    mom_data: Optional[dict]       # Structured MoM as dict (for PDF generation)

    # Error tracking
    error_message: Optional[str]
