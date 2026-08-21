"""
Reanalyzer Agent Node.
Fixes validation errors in extracted action items by re-reading the transcript.
"""
import os
import json
import logging
import re
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from prompts.reanalyzer_prompt import REANALYZER_PROMPT

load_dotenv()
logger = logging.getLogger(__name__)

REANALYZER_MODEL = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-120b")


def get_llm() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set.")
    return ChatGroq(model=REANALYZER_MODEL, api_key=api_key, temperature=0.1, max_tokens=4096)


def _parse_json_response(response: str) -> list:
    """Extract JSON array from LLM response."""
    response = response.strip()
    if response.startswith("```"):
        lines = response.split("\n")
        response = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    try:
        parsed = json.loads(response)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError as e:
        logger.warning(f"Reanalysis JSON parse error: {e}")
        return []


def clean_thinking(text: str) -> str:
    """Strip <think>...</think> blocks from LLM response."""
    return re.sub(r"<think>.*?(?:</think>|\Z)", "", text, flags=re.DOTALL).strip()


import time


def reanalyzer_node(state: dict) -> dict:
    """
    LangGraph node: Re-analyze transcript to fix validation errors in action items.

    Reads: transcript, analysis, extracted_action_items, validation_errors
    Writes: extracted_action_items, validation_errors (clears them)
    """
    logger.info("▶ Node: Reanalyzer")
    # Sleep to reset the Groq token bucket rate limit (TPM)
    time.sleep(15)
    try:
        transcript = state.get("transcript", "")
        analysis = state.get("analysis", "")
        action_items = state.get("extracted_action_items", [])
        validation_errors = state.get("validation_errors", [])

        action_items_str = json.dumps(action_items, indent=2)
        errors_str = json.dumps(validation_errors, indent=2)

        prompt = PromptTemplate(
            template=REANALYZER_PROMPT,
            input_variables=["transcript", "analysis", "action_items", "validation_errors"],
        )
        chain = prompt | get_llm() | StrOutputParser()
        response = chain.invoke({
            "transcript": transcript,
            "analysis": analysis,
            "action_items": action_items_str,
            "validation_errors": errors_str,
        })
        response = clean_thinking(response)

        corrected_items = _parse_json_response(response)
        if not corrected_items:
            logger.warning("Reanalyzer returned empty list, keeping original items.")
            corrected_items = action_items

        logger.info(f"Reanalysis complete. {len(corrected_items)} action items after correction.")

        return {
            **state,
            "extracted_action_items": corrected_items,
            "validation_errors": [],  # Clear errors for next validation pass
        }

    except Exception as e:
        logger.error(f"Reanalyzer failed: {e}")
        return {**state, "error_message": str(e)}
