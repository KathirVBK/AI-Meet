"""
LLM-as-a-Judge for evaluating Summary quality.
Uses ChatGroq to score relevance, completeness, faithfulness, and conciseness.
"""
import os
import json
import logging
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

logger = logging.getLogger(__name__)

JUDGE_PROMPT = """
You are an expert academic evaluator. Your task is to evaluate an AI-generated meeting summary against the original transcript and the ground truth summary.

TRANSCRIPT:
{transcript}

GROUND TRUTH SUMMARY:
{ground_truth}

AI GENERATED SUMMARY:
{generated_summary}

Please score the AI GENERATED SUMMARY on the following 4 criteria, from 1 (worst) to 5 (best):
1. Relevance: Does it capture the most important points without focusing on trivia?
2. Completeness: Did it miss any key details present in the ground truth?
3. Faithfulness: Are there any hallucinations or incorrect facts? (5 = entirely factual, 1 = major hallucinations)
4. Conciseness: Is it brief and well-written?

Respond ONLY with a valid JSON object in the following format:
{{
  "relevance": <int>,
  "completeness": <int>,
  "faithfulness": <int>,
  "conciseness": <int>,
  "reasoning": "<short explanation>"
}}
"""

def evaluate_summary(transcript: str, ground_truth: str, generated_summary: str) -> dict:
    """Uses LLM to evaluate the generated summary."""
    try:
        llm = ChatGroq(model=os.getenv("GROQ_LLM_MODEL", "llama3-8b-8192"), temperature=0.1)
        prompt = PromptTemplate(
            template=JUDGE_PROMPT,
            input_variables=["transcript", "ground_truth", "generated_summary"]
        )
        chain = prompt | llm | StrOutputParser()
        
        response = chain.invoke({
            "transcript": transcript,
            "ground_truth": ground_truth,
            "generated_summary": generated_summary
        })
        
        # Clean response
        response = response.strip()
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            response = response.split("```")[1].split("```")[0].strip()
            
        return json.loads(response)
    except Exception as e:
        logger.error(f"LLM Judge failed: {e}")
        return {
            "relevance": 0, "completeness": 0, "faithfulness": 0, "conciseness": 0,
            "reasoning": f"Failed to parse LLM response: {str(e)}"
        }
