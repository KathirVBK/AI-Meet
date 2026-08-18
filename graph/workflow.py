"""
LangGraph Workflow Compiler.
Defines and compiles the stateful agent graph with nodes, edges, and conditional routing.
"""
import logging
from typing import Optional
from langgraph.graph import StateGraph, END
from graph.state import GraphState
from graph.router import validation_router
from agents.meeting_analyzer import meeting_analyzer_node
from agents.action_extractor import action_extractor_node
from agents.validator import validator_node
from agents.reanalyzer import reanalyzer_node
from agents.mom_generator import mom_generator_node

logger = logging.getLogger(__name__)

# Node name constants
NODE_ANALYZER     = "meeting_analyzer"
NODE_EXTRACTOR    = "action_extractor"
NODE_VALIDATOR    = "validator"
NODE_REANALYZER   = "reanalyzer"
NODE_MOM          = "mom_generator"


def build_workflow():
    """
    Build and compile the LangGraph StateGraph workflow.

    Graph structure:
        meeting_analyzer → action_extractor → validator
            ↑                                      |
            |                              [conditional routing]
            |                            /                      \\
            └──── reanalyzer ◄──────────                  mom_generator → END

    Returns:
        Compiled LangGraph application (CompiledGraph).
    """
    logger.info("Building LangGraph workflow...")

    workflow = StateGraph(GraphState)

    # ── Add nodes ───────────────────────────────────────────────────────────
    workflow.add_node(NODE_ANALYZER,  meeting_analyzer_node)
    workflow.add_node(NODE_EXTRACTOR, action_extractor_node)
    workflow.add_node(NODE_VALIDATOR, validator_node)
    workflow.add_node(NODE_REANALYZER, reanalyzer_node)
    workflow.add_node(NODE_MOM,       mom_generator_node)

    # ── Define entry point ──────────────────────────────────────────────────
    workflow.set_entry_point(NODE_ANALYZER)

    # ── Linear edges ────────────────────────────────────────────────────────
    workflow.add_edge(NODE_ANALYZER,  NODE_EXTRACTOR)
    workflow.add_edge(NODE_EXTRACTOR, NODE_VALIDATOR)

    # ── Conditional edge from validator ─────────────────────────────────────
    workflow.add_conditional_edges(
        NODE_VALIDATOR,
        validation_router,
        {
            "reanalyzer":    NODE_REANALYZER,
            "mom_generator": NODE_MOM,
        },
    )

    # ── Reanalyzer loops back to validator ──────────────────────────────────
    workflow.add_edge(NODE_REANALYZER, NODE_VALIDATOR)

    # ── MoM generator leads to end ──────────────────────────────────────────
    workflow.add_edge(NODE_MOM, END)

    compiled = workflow.compile()
    logger.info("LangGraph workflow compiled successfully.")
    return compiled


def run_workflow(
    transcript: str,
    club_name: str = "Student Club",
    meeting_date: str = "N/A",
    *,
    labelled_transcript: str = "",
    transcript_segments: Optional[list] = None,
    participants: Optional[list] = None,
    speaker_mapping: Optional[dict] = None,
) -> dict:
    """
    Execute the meeting minutes generation workflow.

    Args:
        transcript: Plain transcript text (backward-compat input).
        club_name: Name of the student club.
        meeting_date: Date of the meeting.
        labelled_transcript: Speaker-labelled transcript ("Name:\n text").
        transcript_segments: Structured list of speaker turns.
        participants: List of participant names.
        speaker_mapping: Dict {"Speaker 1": "Kathir", ...}.

    Returns:
        Final state dict containing mom, mom_data, action_items, etc.
    """
    app = build_workflow()

    initial_state = {
        # Transcript inputs (speaker-aware + backward compat)
        "transcript": transcript,
        "labelled_transcript": labelled_transcript or "",
        "transcript_segments": list(transcript_segments or []),
        "participants": list(participants or []),
        "speaker_mapping": dict(speaker_mapping or {}),
        # Metadata
        "club_name": club_name,
        "meeting_date": meeting_date,
        # Intermediate
        "analysis": "",
        "extracted_action_items": [],
        "validation_errors": [],
        "validation_attempts": 0,
        # Output
        "mom": "",
        "mom_data": None,
        "error_message": None,
    }

    logger.info("Starting workflow for: %s — %s (participants=%d, segments=%d)",
                club_name, meeting_date,
                len(initial_state["participants"]),
                len(initial_state["transcript_segments"]))
    final_state = app.invoke(initial_state)
    logger.info("Workflow completed.")

    return final_state


def stream_workflow(
    transcript: str,
    club_name: str = "Student Club",
    meeting_date: str = "N/A",
    *,
    labelled_transcript: str = "",
    transcript_segments: Optional[list] = None,
    participants: Optional[list] = None,
    speaker_mapping: Optional[dict] = None,
):
    """
    Stream workflow execution, yielding state updates after each node.
    Used for real-time UI progress tracking in Streamlit.
    Accepts the same speaker-aware keyword arguments as run_workflow().
    """
    app = build_workflow()

    initial_state = {
        "transcript": transcript,
        "labelled_transcript": labelled_transcript or "",
        "transcript_segments": list(transcript_segments or []),
        "participants": list(participants or []),
        "speaker_mapping": dict(speaker_mapping or {}),
        "club_name": club_name,
        "meeting_date": meeting_date,
        "analysis": "",
        "extracted_action_items": [],
        "validation_errors": [],
        "validation_attempts": 0,
        "mom": "",
        "mom_data": None,
        "error_message": None,
    }

    logger.info("Streaming workflow for: %s — %s", club_name, meeting_date)
    for step in app.stream(initial_state):
        for node_name, state in step.items():
            logger.info("  ✓ Completed node: %s", node_name)
            yield node_name, state
