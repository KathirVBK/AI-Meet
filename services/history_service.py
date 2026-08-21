"""
Meeting History Service — SQLAlchemy Edition.
Persistent relational storage for meetings, action items, decisions, and participants.
"""
import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from database.models import Meeting, MeetingParticipant, ActionItem, Decision, Club

logger = logging.getLogger(__name__)


def save_meeting(
    db: Session,
    club_name: str,
    meeting_date: str,
    transcript_preview: str,
    mom_markdown: str,
    mom_data: Optional[dict],
    action_items: list,
    workflow_log: list,
    participants: Optional[list] = None,
    speaker_mapping: Optional[dict] = None,
    labelled_transcript: str = "",
    transcript_segments: Optional[list] = None,
    created_by: str = "",
) -> str:
    """Persist a completed meeting session to the database. Returns the meeting ID."""

    # Look up club
    club = db.query(Club).filter(Club.name == club_name).first()
    club_id = club.id if club else None

    # Build summary
    summary = ""
    if mom_data:
        summary = mom_data.get("summary") or mom_data.get("executive_summary") or ""

    title = ""
    if mom_data:
        title = mom_data.get("meeting_title") or mom_data.get("title") or ""

    meeting = Meeting(
        title=title,
        club_id=club_id,
        club_name=club_name,
        created_by=created_by,
        meeting_date=meeting_date,
        transcript=transcript_preview,
        labelled_transcript=labelled_transcript,
        summary=summary,
        mom_markdown=mom_markdown,
        mom_data_json=json.dumps(mom_data, default=str) if mom_data else None,
        speaker_mapping_json=json.dumps(speaker_mapping) if speaker_mapping else None,
        transcript_segments_json=json.dumps(transcript_segments, default=str) if transcript_segments else None,
    )
    db.add(meeting)
    db.flush()  # Get meeting.id

    # Add participants
    for p_name in (participants or []):
        db.add(MeetingParticipant(meeting_id=meeting.id, participant_name=p_name))

    # Add action items
    for item in (action_items or []):
        if not isinstance(item, dict):
            continue
        db.add(ActionItem(
            meeting_id=meeting.id,
            task=item.get("task", ""),
            owner=item.get("owner") or item.get("person") or item.get("assignee") or "TBD",
            deadline=item.get("deadline"),
            priority=item.get("priority", "Medium"),
            status=item.get("status", "Assigned"),
            evidence=item.get("evidence"),
            notes=item.get("notes"),
        ))

    # Add decisions
    if mom_data and isinstance(mom_data.get("decisions"), list):
        for dec in mom_data["decisions"]:
            if isinstance(dec, dict):
                db.add(Decision(
                    meeting_id=meeting.id,
                    decision=dec.get("decision", ""),
                    status=dec.get("status", "Confirmed"),
                    evidence=dec.get("evidence"),
                ))

    db.commit()
    logger.info("Meeting saved: id=%s, club=%s, participants=%d, action_items=%d",
                meeting.id, club_name, len(participants or []), len(action_items or []))
    return meeting.id


def _meeting_to_dict(meeting: Meeting) -> dict:
    """Convert a Meeting ORM object to the API-compatible dict format."""
    participants_list = [p.participant_name for p in meeting.participants]
    action_items_list = [
        {
            "task": ai.task,
            "owner": ai.owner,
            "person": ai.owner,
            "deadline": ai.deadline,
            "priority": ai.priority,
            "status": ai.status,
            "evidence": ai.evidence,
            "notes": ai.notes,
        }
        for ai in meeting.action_items
    ]
    decisions_list = [
        {
            "decision": d.decision,
            "status": d.status,
            "evidence": d.evidence,
        }
        for d in meeting.decisions
    ]

    mom_data = None
    if meeting.mom_data_json:
        try:
            mom_data = json.loads(meeting.mom_data_json)
        except json.JSONDecodeError:
            mom_data = {}

    speaker_mapping = {}
    if meeting.speaker_mapping_json:
        try:
            speaker_mapping = json.loads(meeting.speaker_mapping_json)
        except json.JSONDecodeError:
            pass

    transcript_segments = []
    if meeting.transcript_segments_json:
        try:
            transcript_segments = json.loads(meeting.transcript_segments_json)
        except json.JSONDecodeError:
            pass

    return {
        "id": meeting.id,
        "saved_at": meeting.created_at.isoformat() if meeting.created_at else "",
        "created_by": meeting.created_by or "",
        "club_name": meeting.club_name or "",
        "meeting_date": meeting.meeting_date or "",
        "title": meeting.title or "",
        "transcript_preview": (meeting.transcript or "")[:500],
        "labelled_transcript": meeting.labelled_transcript or "",
        "mom_markdown": meeting.mom_markdown or "",
        "mom_data": mom_data,
        "action_items": action_items_list,
        "action_item_count": len(action_items_list),
        "high_priority_count": sum(1 for a in action_items_list if a.get("priority") == "High"),
        "participants": participants_list,
        "participant_count": len(participants_list),
        "speaker_mapping": speaker_mapping,
        "transcript_segments": transcript_segments,
        "decisions": decisions_list,
    }


def get_all_meetings(db: Session, current_user: Optional[dict] = None) -> List[dict]:
    """Return saved meetings, filtered by RBAC authorization rules."""
    meetings = db.query(Meeting).order_by(Meeting.created_at.desc()).all()

    if not current_user:
        return [_meeting_to_dict(m) for m in meetings]

    global_role = current_user.get("global_role", "Student")
    if global_role == "Admin":
        return [_meeting_to_dict(m) for m in meetings]

    user_email = current_user.get("email", "")
    user_name = current_user.get("name", "")
    user_clubs = [c.get("club_name") for c in current_user.get("clubs", [])]

    filtered = []
    for m in meetings:
        participants_names = [p.participant_name for p in m.participants]
        is_creator = m.created_by == user_email
        is_club_member = m.club_name in user_clubs
        is_participant = user_name in participants_names

        if is_creator or is_club_member or is_participant:
            filtered.append(_meeting_to_dict(m))

    return filtered


def get_meeting_by_id(db: Session, entry_id: str) -> Optional[dict]:
    """Look up a single meeting by its ID."""
    meeting = db.query(Meeting).filter(Meeting.id == entry_id).first()
    if not meeting:
        return None
    return _meeting_to_dict(meeting)


def update_meeting(db: Session, entry_id: str, updates: dict) -> Optional[dict]:
    """Update specific fields of an existing meeting."""
    meeting = db.query(Meeting).filter(Meeting.id == entry_id).first()
    if not meeting:
        return None

    if "mom_data" in updates and isinstance(updates["mom_data"], dict):
        # Merge into existing mom_data
        existing = {}
        if meeting.mom_data_json:
            try:
                existing = json.loads(meeting.mom_data_json)
            except json.JSONDecodeError:
                pass
        existing.update(updates["mom_data"])
        meeting.mom_data_json = json.dumps(existing, default=str)
        if "title" in updates["mom_data"]:
            meeting.title = updates["mom_data"]["title"]

    if "approved" in updates:
        # Store approval status in mom_data
        existing = {}
        if meeting.mom_data_json:
            try:
                existing = json.loads(meeting.mom_data_json)
            except json.JSONDecodeError:
                pass
        existing["approved"] = updates["approved"]
        meeting.mom_data_json = json.dumps(existing, default=str)

    if "action_items" in updates:
        # Replace all action items
        for ai in meeting.action_items:
            db.delete(ai)
        for item in updates["action_items"]:
            if isinstance(item, dict):
                db.add(ActionItem(
                    meeting_id=meeting.id,
                    task=item.get("task", ""),
                    owner=item.get("owner") or item.get("person") or "TBD",
                    deadline=item.get("deadline"),
                    priority=item.get("priority", "Medium"),
                    status=item.get("status", "Assigned"),
                    evidence=item.get("evidence"),
                    notes=item.get("notes"),
                ))

    db.commit()
    db.refresh(meeting)
    logger.info("Updated meeting: %s", entry_id)
    return _meeting_to_dict(meeting)


def delete_meeting(db: Session, entry_id: str) -> bool:
    """Delete a meeting by ID. Returns True if found and removed."""
    meeting = db.query(Meeting).filter(Meeting.id == entry_id).first()
    if not meeting:
        return False
    db.delete(meeting)
    db.commit()
    logger.info("Deleted meeting: %s", entry_id)
    return True


def get_stats(db: Session) -> dict:
    """Return aggregate statistics across all saved meetings."""
    meetings = db.query(Meeting).all()
    total_action_items = sum(len(m.action_items) for m in meetings)
    total_high = sum(
        1 for m in meetings for ai in m.action_items if ai.priority == "High"
    )
    clubs = list(set(m.club_name for m in meetings if m.club_name))
    return {
        "total_meetings": len(meetings),
        "total_action_items": total_action_items,
        "total_high_priority": total_high,
        "clubs": clubs,
    }
