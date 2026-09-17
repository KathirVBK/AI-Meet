"""
Meeting Analyzer Agent Node.
Analyzes the meeting transcript to extract structure, attendees, agenda, and decisions.
"""
import os
import json
import logging
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from prompts.analyzer_prompt import ANALYZER_PROMPT

load_dotenv()
logger = logging.getLogger(__name__)

ANALYZER_MODEL = os.getenv("GROQ_LLM_MODEL", "qwen/qwen3.8-27b")


def get_llm() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set.")
    return ChatGroq(model=ANALYZER_MODEL, api_key=api_key, temperature=0.1, max_tokens=8192)


import re

def clean_thinking(text: str) -> str:
    """Strip <think>...</think> blocks from LLM response."""
    return re.sub(r"<think>.*?(?:</think>|\Z)", "", text, flags=re.DOTALL).strip()


def meeting_analyzer_node(state: dict) -> dict:
    """
    LangGraph node: Analyze the meeting transcript.

    Reads: transcript, club_name, meeting_date
    Writes: analysis
    """
    logger.info("▶ Node: Meeting Analyzer")
    try:
        transcript = state.get("transcript", "")
        # Truncate to safely fit within Groq's 7,000 token limit for qwen
        if len(transcript) > 18000:
            logger.warning(f"Truncating transcript from {len(transcript)} to 18000 chars to fit token limits")
            transcript = transcript[:18000]

        club_name = state.get("club_name", "Student Club")
        meeting_date = state.get("meeting_date", "Not specified")

        if not transcript:
            raise ValueError("Transcript is empty. Cannot analyze.")

        ai_persona = state.get("ai_persona") or ""
        agenda_items = state.get("agenda_items") or []

        prompt_text = ANALYZER_PROMPT
        extra_guidelines = ""
        if ai_persona:
            extra_guidelines += f"\n\nSPECIAL CLUB GUIDELINES / PERSONA FOR {club_name.upper()}:\n{ai_persona}\nEnsure your summary, discussion points, and tone follow these guidelines strictly."
        if agenda_items:
            extra_guidelines += f"\n\nEXPECTED AGENDA TOPICS FOR THIS MEETING:\n" + "\n".join(f"- {item}" for item in agenda_items) + "\nIn your analysis, identify how well each expected agenda item was addressed."
        if extra_guidelines:
            prompt_text = prompt_text + extra_guidelines

        prompt = PromptTemplate(
            template=prompt_text,
            input_variables=["transcript", "club_name", "meeting_date"],
        )
        chain = prompt | get_llm() | StrOutputParser()
        response = chain.invoke({
            "transcript": transcript,
            "club_name": club_name,
            "meeting_date": meeting_date,
        })
        response = clean_thinking(response)
        
        # Parse JSON
        response = response.strip()
        if response.startswith("```"):
            lines = response.split("\n")
            if lines and lines[-1].strip() == "```":
                response = "\n".join(lines[1:-1])
            else:
                response = "\n".join(lines[1:])
        
        try:
            analysis = json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse analyzer JSON: {e}. Raw: {response}")
            analysis = {}

        logger.info(f"Analysis complete. Output keys: {list(analysis.keys())}")
        return {**state, "analysis": analysis, "error_message": None}

    except Exception as e:
        logger.error(f"Meeting Analyzer failed: {e}")
        return {**state, "analysis": "", "error_message": str(e)}
