"""
Meeting History Service.
Persistent JSON-based storage for all generated meeting sessions.
"""
import os
import json
import uuid
import logging
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger(__name__)

HISTORY_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "meeting_history.json")


def _ensure_file():
    """Ensure the history JSON file and its parent directory exist."""
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    if not os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load_all() -> list:
    """Load all history entries from disk."""
    _ensure_file()
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError):
        return []


def _save_all(entries: list):
    """Write the full list of entries back to disk."""
    _ensure_file()
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False, default=str)


def save_meeting(
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
) -> str:
    """
    Persist a completed meeting session to history.

    Extended to accept and store speaker-aware outputs (participants list,
    speaker label mapping, labelled transcript and segment list) produced by
    the new diarization pipeline. These are stored both at the top level of
    the history entry (for quick filtering/display) and merged into mom_data
    for completeness.

    Returns:
        The unique ID of the saved entry.
    """
    entry_id = str(uuid.uuid4())[:8]

    participants_list = list(participants or [])
    if not participants_list and isinstance(mom_data, dict):
        participants_list = list(
            dict.fromkeys(mom_data.get("participants") or mom_data.get("attendees") or [])
        )

    smap = dict(speaker_mapping or {})
    if not smap and isinstance(mom_data, dict):
        smap = dict(mom_data.get("speaker_mapping") or {})

    seg_list = list(transcript_segments or [])
    if not seg_list and isinstance(mom_data, dict):
        seg_list = list(mom_data.get("transcript_segments") or [])

    # Keep mom_data up to date too (the UI reads from mom_data)
    if isinstance(mom_data, dict):
        if participants_list and not mom_data.get("participants"):
            mom_data["participants"] = list(participants_list)
        if smap and not mom_data.get("speaker_mapping"):
            mom_data["speaker_mapping"] = dict(smap)
        if seg_list and not mom_data.get("transcript_segments"):
            mom_data["transcript_segments"] = list(seg_list)
        if labelled_transcript and not mom_data.get("labelled_transcript"):
            mom_data["labelled_transcript"] = labelled_transcript

    # Per-action status counts for dashboard / filter chips
    assigned_count = sum(1 for a in action_items if str(a.get("status", "Assigned")) == "Assigned")
    accepted_count = sum(1 for a in action_items if str(a.get("status")) == "Accepted")
    pending_count = sum(1 for a in action_items if str(a.get("status")) == "Pending")
    tbd_count = sum(1 for a in action_items if str(a.get("status")) == "TBD")

    entry = {
        "id": entry_id,
        "saved_at": datetime.now().isoformat(),
        "club_name": club_name,
        "meeting_date": meeting_date,
        "transcript_preview": transcript_preview[:500],
        "labelled_transcript": labelled_transcript,
        "mom_markdown": mom_markdown,
        "mom_data": mom_data,
        "action_items": action_items,
        "action_item_count": len(action_items),
        "high_priority_count": sum(1 for a in action_items if a.get("priority") == "High"),
        "status_counts": {
            "Assigned": assigned_count,
            "Accepted": accepted_count,
            "Pending": pending_count,
            "TBD": tbd_count,
        },
        "participants": participants_list,
        "participant_count": len(participants_list),
        "speaker_mapping": smap,
        "transcript_segments": seg_list,
        "workflow_log": workflow_log,
        "word_count": len(mom_markdown.split()) if mom_markdown else 0,
    }

    entries = _load_all()
    entries.insert(0, entry)  # newest first
    _save_all(entries)
    logger.info("Meeting saved: id=%s, club=%s, participants=%d, action_items=%d",
                entry_id, club_name, len(participants_list), len(action_items))
    return entry_id


def get_all_meetings() -> List[dict]:
    """Return all saved meetings, newest first."""
    return _load_all()


def get_meeting_by_id(entry_id: str) -> Optional[dict]:
    """Look up a single meeting by its ID."""
    for entry in _load_all():
        if entry.get("id") == entry_id:
            return entry
    return None


def update_meeting(entry_id: str, updates: dict) -> Optional[dict]:
    """Update specific fields of an existing meeting."""
    entries = _load_all()
    updated_entry = None
    for entry in entries:
        if entry.get("id") == entry_id:
            # Update fields in the entry
            for key, value in updates.items():
                if key == "action_items" and "action_item_count" not in updates:
                    entry["action_item_count"] = len(value)
                    
                    # Update status counts
                    assigned_count = sum(1 for a in value if str(a.get("status", "Assigned")) == "Assigned")
                    accepted_count = sum(1 for a in value if str(a.get("status")) == "Accepted")
                    pending_count = sum(1 for a in value if str(a.get("status")) == "Pending")
                    tbd_count = sum(1 for a in value if str(a.get("status")) == "TBD")
                    
                    entry["status_counts"] = {
                        "Assigned": assigned_count,
                        "Accepted": accepted_count,
                        "Pending": pending_count,
                        "TBD": tbd_count,
                    }
                    entry["high_priority_count"] = sum(1 for a in value if a.get("priority") == "High")

                # If updating mom_data title, handle carefully
                if key == "mom_data" and isinstance(entry.get("mom_data"), dict) and isinstance(value, dict):
                    entry["mom_data"].update(value)
                else:
                    entry[key] = value
            updated_entry = entry
            break
            
    if updated_entry:
        _save_all(entries)
        logger.info(f"Updated meeting history entry: {entry_id}")
    return updated_entry


def delete_meeting(entry_id: str) -> bool:
    """Delete a meeting entry by ID. Returns True if found and removed."""
    entries = _load_all()
    original_len = len(entries)
    entries = [e for e in entries if e.get("id") != entry_id]
    if len(entries) < original_len:
        _save_all(entries)
        logger.info(f"Deleted meeting history entry: {entry_id}")
        return True
    return False


def get_stats() -> dict:
    """Return aggregate statistics across all saved meetings."""
    entries = _load_all()
    total_action_items = sum(e.get("action_item_count", 0) for e in entries)
    total_high = sum(e.get("high_priority_count", 0) for e in entries)
    clubs = list(set(e.get("club_name", "") for e in entries if e.get("club_name")))
    return {
        "total_meetings": len(entries),
        "total_action_items": total_action_items,
        "total_high_priority": total_high,
        "clubs": clubs,
    }
