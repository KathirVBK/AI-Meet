"""
MoM Generator Agent Node.
Compiles the final Minutes of Meeting from analysis and validated action items.
"""
import os
import json
import logging
import re
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def _build_mom_data(state: dict) -> dict:
    """
    Build a structured dict from state for PDF generation + UI display.
    """
    analysis = state.get("analysis", {})
    if not isinstance(analysis, dict):
        analysis = {}
        
    action_items = state.get("extracted_action_items", [])

    attendees_raw = analysis.get("attendees", [])
    participants = state.get("participants") or []
    if not participants:
        participants = attendees_raw or ["Not recorded"]

    # Dedupe while preserving order
    seen = set()
    participants_deduped = []
    for p in participants:
        if p and p not in seen:
            seen.add(p)
            participants_deduped.append(p)
    if not participants_deduped:
        participants_deduped = ["Not recorded"]

    attendees_set = set(participants_deduped)
    attendees_set.update(attendees_raw)
    attendees_sorted = sorted(attendees_set - {"Not recorded"}) or ["Not recorded"]

    summary = analysis.get("executive_summary") or analysis.get("summary") or ""

    return {
        "meeting_title": analysis.get("meeting_title") or f"{state.get('club_name','Student Club')} Meeting",
        "club_name": state.get("club_name", "Student Club"),
        "date": analysis.get("date") or state.get("meeting_date", datetime.now().strftime("%B %d, %Y")),
        "venue": analysis.get("venue") or "N/A",
        "attendees": attendees_sorted,
        "participants": participants_deduped,
        "speaker_mapping": dict(state.get("speaker_mapping") or {}),
        "agenda": analysis.get("agenda", []),
        "discussion_points": analysis.get("discussion_points", []),
        "decisions": analysis.get("decisions", []),
        "action_items": action_items,
        "summary": summary,
        "executive_summary": summary,
        "next_meeting": analysis.get("next_meeting") or "Not mentioned",
        "transcript_segments": list(state.get("transcript_segments") or []),
    }


def _generate_markdown_mom(mom_data: dict) -> str:
    """Programmatically convert the JSON mom_data into Markdown for the UI."""
    md = []
    md.append(f"# Minutes of Meeting\n## {mom_data.get('club_name', 'Student Club')}\n")
    
    md.append("| Field | Details |")
    md.append("|---|---|")
    md.append(f"| Date | {mom_data.get('date', 'N/A')} |")
    md.append(f"| Venue | {mom_data.get('venue', 'N/A')} |")
    md.append(f"| Prepared By | AI Meeting Assistant |\n")
    
    md.append("## Attendees\n")
    for a in mom_data.get("attendees", []):
        md.append(f"- {a}")

    md.append("\n## Agenda\n")
    for i, a in enumerate(mom_data.get("agenda", []), 1):
        md.append(f"{i}. {a}")
    
    md.append("\n## Key Discussions\n")
    for d in mom_data.get("discussion_points", []):
        md.append(f"- {d}")
        
    md.append("\n## Decisions Made\n")
    for d in mom_data.get("decisions", []):
        if isinstance(d, dict):
            md.append(f"- **{d.get('decision', '')}** (Status: {d.get('status', 'Confirmed')})")
        else:
            md.append(f"- {d}")
            
    md.append("\n## Action Items\n")
    md.append("| # | Task | Owner | Deadline | Priority | Status |")
    md.append("|---|------|----------|----------|----------|--------|")
    for i, ai in enumerate(mom_data.get("action_items", []), 1):
        md.append(f"| {i} | {ai.get('task', '')} | {ai.get('owner', '')} | {ai.get('deadline', '')} | {ai.get('priority', '')} | {ai.get('status', '')} |")
        
    md.append(f"\n## Executive Summary\n\n{mom_data.get('summary', '')}\n")
    md.append(f"\n## Next Meeting\n\n{mom_data.get('next_meeting', 'To be scheduled')}\n")
    
    md.append("\n---\n*Minutes compiled automatically by AI Meeting Assistant*")
    return "\n".join(md)


def clean_thinking(text: str) -> str:
    """Strip <think>...</think> blocks from LLM response."""
    return re.sub(r"<think>.*?(?:</think>|\Z)", "", text, flags=re.DOTALL).strip()


def mom_generator_node(state: dict) -> dict:
    """
    LangGraph node: Generate the final Minutes of Meeting document.
    """
    logger.info("▶ Node: MoM Generator")
    try:
        mom_data = _build_mom_data(state)
        mom_markdown = _generate_markdown_mom(mom_data)
        logger.info(f"MoM generated from JSON. Length: {len(mom_markdown)} chars")

        return {**state, "mom": mom_markdown, "mom_data": mom_data, "error_message": None}

    except Exception as e:
        logger.error(f"MoM Generator failed: {e}")
        return {**state, "mom": "", "mom_data": None, "error_message": str(e)}
