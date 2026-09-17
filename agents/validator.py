"""
Validator Agent Node.
Validates the quality and completeness of extracted action items.
"""
import os
import json
import logging
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from prompts.validator_prompt import VALIDATOR_PROMPT

load_dotenv()
logger = logging.getLogger(__name__)

VALIDATOR_MODEL = os.getenv("GROQ_LLM_MODEL", "qwen/qwen3.8-27b")


def get_llm() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set.")
    return ChatGroq(model=VALIDATOR_MODEL, api_key=api_key, temperature=0.0, max_tokens=1024)


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
        logger.warning(f"Validation JSON parse error: {e}")
        return []


import time


def validator_node(state: dict) -> dict:
    """
    LangGraph node: Validate extracted action items for quality and completeness.

    Reads: transcript, extracted_action_items
    Writes: validation_errors, validation_attempts
    """
    logger.info("▶ Node: Validator")
    current_attempts = state.get("validation_attempts", 0)
    action_items = state.get("extracted_action_items", [])

    if not action_items:
        logger.info("No action items to validate.")
        return {**state, "validation_errors": [], "validation_attempts": current_attempts + 1}

    max_retries = 3
    for attempt in range(max_retries):
        wait_time = 30 * (attempt + 1)
        logger.info("Rate limit cooldown: waiting %ds before validator attempt %d/%d", wait_time, attempt + 1, max_retries)
        time.sleep(wait_time)

        try:
            transcript = state.get("transcript", "")
            if len(transcript) > 18000:
                transcript = transcript[:18000]
                
            action_items_str = json.dumps(action_items, indent=2)

            prompt = PromptTemplate(
                template=VALIDATOR_PROMPT,
                input_variables=["transcript", "action_items"],
            )
            chain = prompt | get_llm() | StrOutputParser()
            response = chain.invoke({
                "transcript": transcript,
                "action_items": action_items_str,
            })

            errors = _parse_json_response(response)
            logger.info(f"Validation found {len(errors)} issue(s). Attempt #{current_attempts + 1}")

            return {
                **state,
                "validation_errors": errors,
                "validation_attempts": current_attempts + 1,
            }

        except Exception as e:
            logger.warning("Validator attempt %d/%d failed: %s", attempt + 1, max_retries, e)
            if attempt < max_retries - 1:
                continue
            else:
                logger.error(f"Validator failed after {max_retries} attempts: {e}")

    # If all retries failed, pass through with no errors (let the workflow continue)
    return {**state, "validation_errors": [], "validation_attempts": current_attempts + 1}
