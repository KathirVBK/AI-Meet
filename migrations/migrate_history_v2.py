"""
Meeting History Migration Script (v1 → v2 speaker-aware schema).

Run this script ONCE after pulling the speaker-identification feature to
upgrade existing entries in `data/meeting_history.json` so they contain the
new top-level fields (participants, speaker_mapping, status_counts,
transcript_segments, labelled_transcript) introduced by the speaker
diarization / name-detection pipeline.

What the migration does (SAFE and IDEMPOTENT):
  - Reads `data/meeting_history.json`.
  - For every existing entry that is missing a field, backfills it from
    `mom_data` (wherever the MoM generator has already produced it) or
    from a sensible default (empty list / dict).
  - For entries created before the speaker pipeline existed, participants
    are derived from `mom_data.attendees` (the LLM's legacy attendee list).
  - Action items that were written pre-v2 get status="Assigned" added so
    the new UI badges always have a value.
  - Writes the upgraded file back to disk (original is preserved as a
    timestamped .bak in the same folder).

Usage (from the project root):
    python migrations/migrate_history_v2.py
"""
from __future__ import annotations

import os
import json
import shutil
import logging
from datetime import datetime
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("migrate_v2")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HISTORY_PATH = os.path.join(ROOT, "data", "meeting_history.json")
BACKUP_PATH = os.path.join(
    os.path.dirname(HISTORY_PATH),
    f"meeting_history_v1_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
)


def _upgrade_action_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure every action item has the 7+ keys required by the new UI."""
    upgraded: List[Dict[str, Any]] = []
    for it in items or []:
        if not isinstance(it, dict):
            continue
        new = dict(it)
        # Backfill fields with defaults that match the v2 contract
        if "assignee" not in new or not new["assignee"]:
            new["assignee"] = new.get("person") or "TBD"
        if "person" not in new or not new["person"]:
            new["person"] = new.get("assignee") or "TBD"
        if "status" not in new or not new["status"]:
            new["status"] = "Assigned"
        if "priority" not in new or not new["priority"]:
            new["priority"] = "Medium"
        if "deadline" not in new or not new["deadline"]:
            new["deadline"] = "Not specified"
        if "task" not in new:
            new["task"] = ""
        if "notes" not in new:
            new["notes"] = None
        if "source_speaker" not in new:
            new["source_speaker"] = None
        upgraded.append(new)
    return upgraded


def _upgrade_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Add the new top-level fields to a single history entry (if missing)."""
    if not isinstance(entry, dict):
        return entry
    e = dict(entry)
    mom = e.get("mom_data") if isinstance(e.get("mom_data"), dict) else {}

    # participants: prefer top-level, else participants in mom, else legacy attendees
    if not e.get("participants"):
        derived = (
            mom.get("participants")
            or mom.get("attendees")
            or []
        )
        if isinstance(derived, list):
            # drop empty strings, dedupe preserving order
            seen = set()
            clean = []
            for p in derived:
                if isinstance(p, str) and p and p not in seen and p != "Not recorded":
                    seen.add(p)
                    clean.append(p)
            e["participants"] = clean
        else:
            e["participants"] = []
    e["participant_count"] = len(e["participants"])

    # speaker_mapping
    if not e.get("speaker_mapping"):
        sm = mom.get("speaker_mapping")
        e["speaker_mapping"] = dict(sm) if isinstance(sm, dict) else {}

    # transcript_segments
    if not e.get("transcript_segments"):
        segs = mom.get("transcript_segments")
        e["transcript_segments"] = list(segs) if isinstance(segs, list) else []

    # labelled_transcript
    if not e.get("labelled_transcript"):
        e["labelled_transcript"] = mom.get("labelled_transcript") or ""

    # action_items + counts
    upgraded_items = _upgrade_action_items(e.get("action_items") or mom.get("action_items") or [])
    e["action_items"] = upgraded_items
    e["action_item_count"] = len(upgraded_items)
    e["high_priority_count"] = sum(1 for a in upgraded_items if a.get("priority") == "High")
    e["status_counts"] = {
        "Assigned": sum(1 for a in upgraded_items if a.get("status") == "Assigned"),
        "Accepted": sum(1 for a in upgraded_items if a.get("status") == "Accepted"),
        "Pending":  sum(1 for a in upgraded_items if a.get("status") == "Pending"),
        "TBD":      sum(1 for a in upgraded_items if a.get("status") == "TBD"),
    }

    # word_count fallback
    if not e.get("word_count"):
        md = e.get("mom_markdown") or ""
        e["word_count"] = len(md.split())

    # Keep mom_data's action items in sync too
    if isinstance(e.get("mom_data"), dict):
        e["mom_data"]["action_items"] = upgraded_items
        if not e["mom_data"].get("participants"):
            e["mom_data"]["participants"] = list(e["participants"])
        if not e["mom_data"].get("speaker_mapping"):
            e["mom_data"]["speaker_mapping"] = dict(e["speaker_mapping"])
        if not e["mom_data"].get("transcript_segments"):
            e["mom_data"]["transcript_segments"] = list(e["transcript_segments"])

    return e


def main() -> None:
    if not os.path.exists(HISTORY_PATH):
        log.info("No history file found at %s — nothing to migrate.", HISTORY_PATH)
        return

    with open(HISTORY_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    entries = raw if isinstance(raw, list) else list(raw.values()) if isinstance(raw, dict) else []
    log.info("Read %d entries from %s", len(entries), HISTORY_PATH)

    # Backup first
    shutil.copy2(HISTORY_PATH, BACKUP_PATH)
    log.info("Backup written → %s", BACKUP_PATH)

    upgraded_entries = [_upgrade_entry(e) for e in entries]

    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(upgraded_entries, f, indent=2, ensure_ascii=False, default=str)

    log.info("Migration done. %d entries upgraded in place.", len(upgraded_entries))
    log.info("If anything went wrong, restore the backup with:\n    copy \"%s\" \"%s\"",
             BACKUP_PATH, HISTORY_PATH)


if __name__ == "__main__":
    main()
