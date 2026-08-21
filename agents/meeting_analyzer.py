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

ANALYZER_MODEL = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-120b")


def get_llm() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set.")
    return ChatGroq(model=ANALYZER_MODEL, api_key=api_key, temperature=0.1, max_tokens=4096)


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
        club_name = state.get("club_name", "Student Club")
        meeting_date = state.get("meeting_date", "Not specified")

        if not transcript:
            raise ValueError("Transcript is empty. Cannot analyze.")

        prompt = PromptTemplate(
            template=ANALYZER_PROMPT,
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
