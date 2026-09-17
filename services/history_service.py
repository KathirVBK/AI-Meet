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
    approval_status: str = "APPROVED",
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
        approval_status=approval_status,
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
            nudge_count=item.get("nudge_count", 0),
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
    logger.info("Meeting saved: id=%s, club=%s, approval=%s, participants=%d, action_items=%d",
                meeting.id, club_name, approval_status, len(participants or []), len(action_items or []))
    return meeting.id


def _meeting_to_dict(meeting: Meeting) -> dict:
    """Convert a Meeting ORM object to the API-compatible dict format."""
    participants_list = [p.participant_name for p in meeting.participants]
    action_items_list = [
        {
            "id": ai.id,
            "task": ai.task,
            "owner": ai.owner,
            "person": ai.owner,
            "deadline": ai.deadline,
            "priority": ai.priority,
            "status": ai.status,
            "evidence": ai.evidence,
            "notes": ai.notes,
            "nudge_count": ai.nudge_count or 0,
            "last_nudged_at": ai.last_nudged_at.isoformat() if ai.last_nudged_at else None,
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
        "approval_status": meeting.approval_status or "APPROVED",
        "approval_notes": meeting.approval_notes or "",
        "approved_by": meeting.approved_by or "",
        "approved_at": meeting.approved_at.isoformat() if meeting.approved_at else None,
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
    
    if not current_user:
        return []

    global_role = current_user.get("global_role", "STUDENT")
    user_id = current_user.get("id", "")
    user_name = current_user.get("name", "")
    
    query = db.query(Meeting)
    
    if global_role == "SUPER_ADMIN":
        pass # Super admin sees all meetings
    elif global_role == "ADMIN":
        # ADMIN can view all meetings for clubs they coordinate (including pending), or normal approved meetings
        from database.models import ClubMember
        coordinated_clubs = db.query(Club.name).join(ClubMember).filter(
            ClubMember.user_id == user_id,
            ClubMember.role == "Coordinator"
        ).subquery()
        
        user_clubs = [c.get("club_name") for c in current_user.get("clubs", [])]
        
        query = query.filter(
            (Meeting.club_name.in_(coordinated_clubs)) |
            (Meeting.created_by == user_id) |
            (
                ((Meeting.club_name.in_(user_clubs)) | (Meeting.participants.any(participant_name=user_name)))
                & (Meeting.approval_status == "APPROVED")
            )
        )
    else:
        # STUDENT: Can see their own meetings even if pending, but others only if APPROVED
        user_clubs = [c.get("club_name") for c in current_user.get("clubs", [])]
        query = query.filter(
            (Meeting.created_by == user_id) |
            (
                ((Meeting.club_name.in_(user_clubs)) | (Meeting.participants.any(participant_name=user_name)))
                & (Meeting.approval_status == "APPROVED")
            )
        )

    meetings = query.order_by(Meeting.created_at.desc()).all()
    return [_meeting_to_dict(m) for m in meetings]


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


def get_pending_meetings(db: Session, current_user: dict) -> List[dict]:
    """Return meetings awaiting approval, scoped to the admin's clubs."""
    global_role = current_user.get("global_role", "STUDENT")
    user_id = current_user.get("id", "")
    
    query = db.query(Meeting).filter(Meeting.approval_status == "PENDING_REVIEW")
    if global_role == "SUPER_ADMIN":
        pass
    elif global_role == "ADMIN":
        from database.models import ClubMember
        coordinated_clubs = db.query(Club.name).join(ClubMember).filter(
            ClubMember.user_id == user_id,
            ClubMember.role == "Coordinator"
        ).subquery()
        query = query.filter(Meeting.club_name.in_(coordinated_clubs))
    else:
        return []
        
    meetings = query.order_by(Meeting.created_at.desc()).all()
    return [_meeting_to_dict(m) for m in meetings]


def update_meeting_approval(db: Session, meeting_id: str, status: str, notes: Optional[str], approver_user_id: str) -> Optional[dict]:
    """Approve or reject a meeting."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        return None
    meeting.approval_status = status
    if notes is not None:
        meeting.approval_notes = notes
    meeting.approved_by = approver_user_id
    meeting.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(meeting)
    return _meeting_to_dict(meeting)


def get_club_action_items(db: Session, current_user: dict, club_id: Optional[str] = None) -> List[dict]:
    """Fetch all action items across clubs managed by the admin with overdue calculation."""
    global_role = current_user.get("global_role", "STUDENT")
    user_id = current_user.get("id", "")
    
    query = db.query(ActionItem).join(Meeting)
    if club_id:
        query = query.filter(Meeting.club_id == club_id)
    elif global_role != "SUPER_ADMIN":
        from database.models import ClubMember
        coordinated_club_ids = db.query(ClubMember.club_id).filter(
            ClubMember.user_id == user_id,
            ClubMember.role == "Coordinator"
        ).subquery()
        query = query.filter(Meeting.club_id.in_(coordinated_club_ids))
        
    items = query.order_by(ActionItem.created_at.desc()).all()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    results = []
    for ai in items:
        # Check if overdue
        is_overdue = False
        if ai.deadline and ai.status not in ("Completed", "Done"):
            try:
                clean_deadline = ai.deadline.strip()
                if len(clean_deadline) >= 10 and clean_deadline[:10] < today_str:
                    is_overdue = True
            except Exception:
                pass
                
        results.append({
            "id": ai.id,
            "meeting_id": ai.meeting_id,
            "meeting_title": ai.meeting.title if ai.meeting else "Meeting",
            "club_name": ai.meeting.club_name if ai.meeting else "",
            "task": ai.task,
            "owner": ai.owner,
            "deadline": ai.deadline,
            "priority": ai.priority,
            "status": ai.status,
            "evidence": ai.evidence,
            "notes": ai.notes,
            "nudge_count": ai.nudge_count or 0,
            "last_nudged_at": ai.last_nudged_at.isoformat() if ai.last_nudged_at else None,
            "is_overdue": is_overdue,
            "created_at": ai.created_at.isoformat() if ai.created_at else None,
        })
    return results


def nudge_action_item(db: Session, action_item_id: str) -> Optional[dict]:
    """Increment nudge count and record timestamp on an action item."""
    ai = db.query(ActionItem).filter(ActionItem.id == action_item_id).first()
    if not ai:
        return None
    ai.nudge_count = (ai.nudge_count or 0) + 1
    ai.last_nudged_at = datetime.utcnow()
    db.commit()
    db.refresh(ai)
    return {
        "id": ai.id,
        "task": ai.task,
        "owner": ai.owner,
        "nudge_count": ai.nudge_count,
        "last_nudged_at": ai.last_nudged_at.isoformat()
    }


def get_monthly_club_report(db: Session, club_id: str, month: int, year: int) -> dict:
    """Generate aggregate statistics and structured report for a club in a specific month."""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise ValueError("Club not found")
        
    all_meetings = db.query(Meeting).filter(Meeting.club_id == club.id).all()
    
    filtered_meetings = []
    for m in all_meetings:
        in_month = False
        if m.created_at and m.created_at.month == month and m.created_at.year == year:
            in_month = True
        elif m.meeting_date:
            try:
                dt = datetime.strptime(m.meeting_date[:10], "%Y-%m-%d")
                if dt.month == month and dt.year == year:
                    in_month = True
            except Exception:
                pass
        if in_month:
            filtered_meetings.append(m)
            
    total_meetings = len(filtered_meetings)
    all_participants = set()
    total_decisions = 0
    all_action_items = []
    
    for m in filtered_meetings:
        for p in m.participants:
            all_participants.add(p.participant_name)
        total_decisions += len(m.decisions)
        all_action_items.extend(m.action_items)
        
    total_tasks = len(all_action_items)
    completed_tasks = sum(1 for ai in all_action_items if ai.status in ("Completed", "Done"))
    pending_tasks = total_tasks - completed_tasks
    completion_rate = round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1)
    
    month_name = datetime(year, month, 1).strftime("%B %Y")
    
    report_md = f"""# {club.name} — Monthly Activity Report
**Reporting Period:** {month_name}  
**Generated On:** {datetime.utcnow().strftime("%B %d, %Y")}

---

## 1. Executive Summary & KPIs
- **Total Meetings Conducted:** {total_meetings}
- **Active Attendees:** {len(all_participants)} unique participants
- **Official Decisions Confirmed:** {total_decisions}
- **Action Items Created:** {total_tasks} ({completed_tasks} completed, {completion_rate}% completion rate)

---

## 2. Meetings Breakdown
"""
    if filtered_meetings:
        for m in filtered_meetings:
            report_md += f"\n### {m.title or 'Meeting'} ({m.meeting_date or 'No date'})\n"
            report_md += f"- **Summary:** {m.summary or 'No summary recorded.'}\n"
            if m.participants:
                report_md += f"- **Attendees:** {', '.join(p.participant_name for p in m.participants)}\n"
            if m.decisions:
                report_md += f"- **Decisions:** {'; '.join(d.decision for d in m.decisions)}\n"
            if m.action_items:
                report_md += f"- **Key Tasks:** {len(m.action_items)} action items assigned\n"
    else:
        report_md += "\n*No meetings recorded during this period.*\n"

    report_md += f"\n---\n*Report generated automatically by MeetMind AI for {club.name}.*"
    
    return {
        "club_name": club.name,
        "month": month,
        "year": year,
        "month_name": month_name,
        "total_meetings": total_meetings,
        "unique_attendees": list(all_participants),
        "total_decisions": total_decisions,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
        "completion_rate": completion_rate,
        "meetings": [{
            "id": m.id,
            "title": m.title or "Meeting",
            "date": m.meeting_date,
            "summary": m.summary,
            "participants_count": len(m.participants),
            "decisions_count": len(m.decisions),
            "action_items_count": len(m.action_items)
        } for m in filtered_meetings],
        "report_markdown": report_md
    }

