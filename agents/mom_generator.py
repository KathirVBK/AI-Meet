"""
MoM Generator Agent Node.
Compiles the final Minutes of Meeting from analysis and validated action items.
"""
import os
import json
import logging
import re
from datetime import datetime
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from prompts.mom_prompt import MOM_PROMPT

load_dotenv()
logger = logging.getLogger(__name__)

MOM_MODEL = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-120b")


def get_llm() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set.")
    return ChatGroq(model=MOM_MODEL, api_key=api_key, temperature=0.2, max_tokens=4096)


def _extract_section(text: str, header: str) -> list:
    """Extract bullet point items from a specific section in the analysis."""
    pattern = rf"#+ {re.escape(header)}\n(.*?)(?=\n#+|\Z)"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if not match:
        return []
    content = match.group(1)
    items = re.findall(r"[-•*]\s+(.+)", content)
    return [item.strip() for item in items if item.strip()]


def _extract_paragraph(text: str, header: str) -> str:
    """Extract raw text content of a specific section in the analysis."""
    pattern = rf"#+ {re.escape(header)}\n(.*?)(?=\n#+|\Z)"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if not match:
        return ""
    return match.group(1).strip()


def _extract_field(text: str, label: str) -> str:
    """Extract a single field value from analysis text."""
    pattern = rf"\*\*{re.escape(label)}\*\*[:\s]+(.+)"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else "N/A"


def _build_mom_data(state: dict, mom_markdown: str) -> dict:
    """
    Build a structured dict from state for PDF generation + UI display.

    Extended to include the new speaker-aware fields (participants,
    speaker_mapping, transcript_segments) that the frontend / action extractor
    rely on. These live alongside the legacy attendees field so that older
    consumers continue to work.
    """
    analysis = state.get("analysis", "")
    action_items = state.get("extracted_action_items", [])

    # Parse attendees from analysis (legacy field)
    attendees_raw = _extract_field(analysis, "Attendees")
    legacy_attendees = [a.strip() for a in attendees_raw.split(",") if a.strip() and attendees_raw != "N/A"]

    # Prefer the resolved participants list (from speaker pipeline); fall back
    # to legacy attendees or "Not recorded".
    participants = state.get("participants") or []
    if not participants:
        participants = legacy_attendees or ["Not recorded"]

    # Dedupe while preserving order
    seen = set()
    participants_deduped = []
    for p in participants:
        if p and p not in seen:
            seen.add(p)
            participants_deduped.append(p)
    if not participants_deduped:
        participants_deduped = ["Not recorded"]

    # Attendees is kept for backward compat; union of participants + legacy
    attendees_set = set(participants_deduped)
    attendees_set.update(legacy_attendees)
    attendees_sorted = sorted(attendees_set - {"Not recorded"}) or ["Not recorded"]

    summary = _extract_paragraph(analysis, "EXECUTIVE SUMMARY")
    if not summary:
        summary = (
            mom_markdown[:500] if len(mom_markdown) > 500 else mom_markdown
        )

    return {
        # Core MoM metadata
        "title": _extract_field(analysis, "Title") or f"{state.get('club_name','Student Club')} Meeting",
        "club_name": state.get("club_name", "Student Club"),
        "date": state.get("meeting_date", datetime.now().strftime("%B %d, %Y")),
        "venue": _extract_field(analysis, "Venue/Platform"),
        # Attendance (legacy + new)
        "attendees": attendees_sorted,
        "participants": participants_deduped,
        "speaker_mapping": dict(state.get("speaker_mapping") or {}),
        # Content sections
        "agenda_items": _extract_section(analysis, "AGENDA ITEMS"),
        "key_discussions": _extract_section(analysis, "KEY DISCUSSIONS"),
        "decisions": _extract_section(analysis, "DECISIONS MADE"),
        "action_items": action_items,
        "summary": summary,
        "executive_summary": summary,  # alias used by frontend
        "key_decisions": _extract_section(analysis, "DECISIONS MADE"),  # alias used by frontend
        "next_meeting": _extract_field(analysis, "NEXT MEETING"),
        # Speaker-aware transcript
        "transcript_segments": list(state.get("transcript_segments") or []),
    }


import re

def clean_thinking(text: str) -> str:
    """Strip <think>...</think> blocks from LLM response."""
    return re.sub(r"<think>.*?(?:</think>|\Z)", "", text, flags=re.DOTALL).strip()


import time


def mom_generator_node(state: dict) -> dict:
    """
    LangGraph node: Generate the final Minutes of Meeting document.

    Reads: club_name, meeting_date, analysis, extracted_action_items
    Writes: mom, mom_data
    """
    logger.info("▶ Node: MoM Generator")
    # Sleep to reset the Groq token bucket rate limit (TPM)
    time.sleep(15)
    try:
        club_name = state.get("club_name", "Student Club")
        meeting_date = state.get("meeting_date", "Not specified")
        analysis = state.get("analysis", "")
        action_items = state.get("extracted_action_items", [])

        action_items_str = json.dumps(action_items, indent=2)

        prompt = PromptTemplate(
            template=MOM_PROMPT,
            input_variables=["club_name", "meeting_date", "analysis", "action_items"],
        )
        chain = prompt | get_llm() | StrOutputParser()
        mom_markdown = chain.invoke({
            "club_name": club_name,
            "meeting_date": meeting_date,
            "analysis": analysis,
            "action_items": action_items_str,
        })
        mom_markdown = clean_thinking(mom_markdown)

        mom_data = _build_mom_data(state, mom_markdown)
        logger.info(f"MoM generated. Length: {len(mom_markdown)} chars")

        return {**state, "mom": mom_markdown, "mom_data": mom_data, "error_message": None}

    except Exception as e:
        logger.error(f"MoM Generator failed: {e}")
        return {**state, "mom": "", "mom_data": None, "error_message": str(e)}
