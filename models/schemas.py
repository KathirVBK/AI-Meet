"""
Pydantic schemas for structured data models used across the application.
Extended to support speaker diarization, participant lists, and action item
status tracking (Assigned vs Accepted).
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class Priority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class TaskStatus(str, Enum):
    """
    Status of an extracted action item, reflecting how ownership was established:
      - ASSIGNED : Speaker self-assigned the task (I will… / I'll…) or was directly named.
      - ACCEPTED : Task was requested of a person AND they explicitly accepted it.
      - PENDING  : A request was made but no acceptance has been detected yet.
      - TBD      : Owner is not yet determinable.
    """
    ASSIGNED = "Assigned"
    ACCEPTED = "Accepted"
    PENDING = "Pending"
    TBD = "TBD"


class ActionItem(BaseModel):
    """Represents a single action item extracted from a meeting."""
    task: str = Field(description="Clear description of the task to be completed")
    assignee: str = Field(description="Name of the person responsible for the task")
    deadline: str = Field(description="Deadline or timeframe for task completion")
    priority: Priority = Field(default=Priority.MEDIUM, description="Priority level: Low, Medium, or High")
    notes: Optional[str] = Field(default=None, description="Additional notes or context for the task")
    status: TaskStatus = Field(default=TaskStatus.ASSIGNED, description="Ownership resolution status")
    source_speaker: Optional[str] = Field(default=None, description="Speaker label/name of the person who spoke the turn")


class ValidationError(BaseModel):
    """Represents a validation error found in an action item."""
    item_index: int = Field(description="Index of the action item with the error")
    field: str = Field(description="Field name that has the issue")
    issue: str = Field(description="Description of the validation issue")
    suggestion: str = Field(description="Suggested fix for the issue")


class SpeakerSegmentSchema(BaseModel):
    """Schema for a single diarized + reconstructed speaker turn."""
    index: int = Field(description="Turn index in the reconstructed transcript")
    speaker_label: str = Field(description="Original speaker label e.g. Speaker 1")
    speaker_name: str = Field(description="Detected real name or falls back to speaker_label")
    start_time: float = Field(description="Turn start time in seconds")
    end_time: float = Field(description="Turn end time in seconds")
    text: str = Field(description="Transcript text for this speaker turn")


class MeetingMinutes(BaseModel):
    """Represents the complete Minutes of Meeting document."""
    title: str = Field(description="Title of the meeting")
    club_name: str = Field(default="Student Club", description="Name of the student club")
    date: str = Field(description="Date and time of the meeting")
    venue: Optional[str] = Field(default="N/A", description="Location or platform of the meeting")
    attendees: List[str] = Field(description="List of attendees present in the meeting")
    participants: List[str] = Field(default_factory=list, description="Final list of participant names resolved from speakers")
    speaker_mapping: Dict[str, str] = Field(default_factory=dict, description="Speaker 1 -> Kathir mapping")
    agenda_items: List[str] = Field(description="List of agenda items discussed")
    key_discussions: List[str] = Field(description="Key discussion points from the meeting")
    decisions: List[str] = Field(description="List of decisions made during the meeting")
    action_items: List[ActionItem] = Field(description="List of action items with owners and deadlines")
    summary: str = Field(description="Executive summary of the meeting")
    next_meeting: Optional[str] = Field(default=None, description="Date or details of next scheduled meeting")
    transcript_segments: Optional[List[SpeakerSegmentSchema]] = Field(default=None, description="Structured speaker turns for downstream UI rendering")


class GraphState(BaseModel):
    """LangGraph state shared across all agent nodes."""
    transcript: str = Field(default="", description="Raw meeting transcript (backward-compat plain text)")
    labelled_transcript: str = Field(default="", description="Speaker-labelled transcript (e.g. 'Kathir:\\nI will...')")
    transcript_segments: List[Dict[str, Any]] = Field(default_factory=list, description="Structured speaker turns list")
    participants: List[str] = Field(default_factory=list, description="Resolved participant names list")
    speaker_mapping: Dict[str, str] = Field(default_factory=dict, description="Speaker label -> real name mapping")
    club_name: str = Field(default="Student Club", description="Name of the student club")
    meeting_date: str = Field(default="", description="Date of the meeting")
    analysis: str = Field(default="", description="Structured meeting analysis from the analyzer agent")
    extracted_action_items: List[ActionItem] = Field(default_factory=list, description="Action items extracted")
    validation_errors: List[ValidationError] = Field(default_factory=list, description="Validation errors found")
    validation_attempts: int = Field(default=0, description="Number of validation+reanalysis attempts")
    mom: str = Field(default="", description="Final Minutes of Meeting in markdown format")
    mom_data: Optional[MeetingMinutes] = Field(default=None, description="Structured MoM data object")
    error_message: Optional[str] = Field(default=None, description="Any error during pipeline execution")
