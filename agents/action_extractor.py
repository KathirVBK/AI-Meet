"""
Action Extractor Agent Node.
Extracts structured action items from the transcript + meeting analysis.

Extended to accept speaker-aware inputs (labelled transcript, participants,
speaker mapping) so that the LLM can implement the three task assignment rules:
  1. Self-assignment  → Assigned
  2. Explicit naming  → Assigned
  3. Request-accept   → Accepted / Pending
"""
import os
import json
import logging
from typing import Dict, Any, List
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from prompts.extractor_prompt import EXTRACTOR_PROMPT

load_dotenv()
logger = logging.getLogger(__name__)

EXTRACTOR_MODEL = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-120b")

# Fields that the newer action items format may include (beyond the original 5).
# We ensure these are always set so that downstream consumers never see missing keys.
_DEFAULT_ACTION_ITEM_KEYS = {
    "task": "",
    "assignee": "TBD",
    "deadline": "Not specified",
    "priority": "Medium",
    "status": "Assigned",
    "source_speaker": None,
    "notes": None,
}


def get_llm() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set.")
    return ChatGroq(model=EXTRACTOR_MODEL, api_key=api_key, temperature=0.0, max_tokens=4096)


def _parse_json_response(response: str) -> List[Dict[str, Any]]:
    """Extract JSON array from LLM response, handling markdown code blocks."""
    response = response.strip()
    if response.startswith("```"):
        lines = response.split("\n")
        # Drop the opening fence and closing fence if present
        if lines and lines[-1].strip() == "```":
            response = "\n".join(lines[1:-1])
        else:
            response = "\n".join(lines[1:])
    # Sometimes models wrap the array with extra text; try to find [ ... ]
    stripped = response.strip()
    if not (stripped.startswith("[") and stripped.endswith("]")):
        start = stripped.find("[")
        end = stripped.rfind("]")
        if 0 <= start < end:
            stripped = stripped[start : end + 1]
            response = stripped

    try:
        parsed = json.loads(response)
        if not isinstance(parsed, list):
            logger.warning("Parsed JSON is not a list. Raw: %s", response[:200])
            return []
        # Normalize each item: fill defaults + lowercase priority + validate status
        normalized = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            filled = dict(_DEFAULT_ACTION_ITEM_KEYS)
            filled.update({k: v for k, v in item.items() if v is not None})
            # Priority normalization
            prio = str(filled.get("priority", "Medium")).title()
            if prio not in {"High", "Medium", "Low"}:
                prio = "Medium"
            filled["priority"] = prio
            # Status normalization
            status = str(filled.get("status", "Assigned")).title()
            if status not in {"Assigned", "Accepted", "Pending", "Tbd"}:
                status = "Assigned"
            filled["status"] = "TBD" if status == "Tbd" else status
            # Deadline
            if not filled.get("deadline"):
                filled["deadline"] = "Not specified"
            normalized.append(filled)
        return normalized
    except json.JSONDecodeError as e:
        logger.warning("JSON parse error: %s. Raw response: %s", e, response[:300])
        return []


def _format_mapping(mapping: Dict[str, str]) -> str:
    """Pretty-print the speaker->name mapping for the prompt."""
    if not mapping:
        return "(no mapping available)"
    lines = [f"  {label}  →  {name}" for label, name in mapping.items()]
    return "\n".join(lines)


def _format_participants(participants: List[str]) -> str:
    if not participants:
        return "(unknown — use Speaker N labels when in doubt)"
    return ", ".join(participants)


import re

def clean_thinking(text: str) -> str:
    """Strip <think>...</think> blocks from LLM response."""
    return re.sub(r"<think>.*?(?:</think>|\Z)", "", text, flags=re.DOTALL).strip()


import time


def action_extractor_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Extract action items from the transcript.

    New input fields (all optional; fallbacks provided):
      labelled_transcript : speaker-labelled transcript text
      participants        : list of resolved participant names
      speaker_mapping     : dict {"Speaker 1": "Kathir", ...}
      transcript_segments : structured speaker turns

    Reads: transcript, analysis, [labelled_transcript, participants, speaker_mapping]
    Writes: extracted_action_items
    """
    logger.info("▶ Node: Action Extractor")
    # Sleep to reset the Groq token bucket rate limit (TPM)
    time.sleep(15)
    try:
        transcript_plain = state.get("transcript", "")
        analysis = state.get("analysis", "")
        labelled_transcript = state.get("labelled_transcript") or ""
        participants = state.get("participants") or []
        speaker_mapping = state.get("speaker_mapping") or {}
        transcript_segments = state.get("transcript_segments") or []

        # Graceful fallback: if no labelled transcript was produced by the new
        # pipeline, fabricate a single-speaker labelled view so the prompt
        # never sees an empty context.
        if not labelled_transcript.strip():
            if transcript_segments:
                parts = []
                for seg in transcript_segments:
                    who = seg.get("speaker_name") or seg.get("speaker_label") or "Speaker"
                    parts.append(f"{who}:\n{seg.get('text','')}")
                labelled_transcript = "\n\n".join(parts)
            elif transcript_plain.strip():
                labelled_transcript = f"Speaker:\n{transcript_plain.strip()}"

        if not participants:
            # Derive participants from mapping values or fall back to mapping keys
            if speaker_mapping:
                participants = list(dict.fromkeys(speaker_mapping.values()))
            else:
                participants = []

        prompt = PromptTemplate(
            template=EXTRACTOR_PROMPT,
            input_variables=[
                "transcript", "analysis",
                "labelled_transcript", "participants", "speaker_mapping",
            ],
        )
        chain = prompt | get_llm() | StrOutputParser()
        response = chain.invoke({
            "transcript": transcript_plain,
            "analysis": analysis,
            "labelled_transcript": labelled_transcript,
            "participants": _format_participants(participants),
            "speaker_mapping": _format_mapping(speaker_mapping),
        })
        response = clean_thinking(response)

        action_items = _parse_json_response(response)
        logger.info("Extracted %d action items.", len(action_items))
        for i, ai in enumerate(action_items):
            logger.info("  [%d] %s | %s | %s | %s",
                        i, ai.get("status", "?"), ai.get("assignee", "?"),
                        ai.get("priority", "?"), (ai.get("task") or "")[:60])

        return {**state, "extracted_action_items": action_items, "error_message": None}

    except Exception as e:
        logger.error("Action Extractor failed: %s", e, exc_info=True)
        return {**state, "extracted_action_items": [], "error_message": str(e)}
