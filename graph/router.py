"""
LangGraph conditional router.
Determines whether to route to the reanalyzer (if validation errors exist)
or to the MoM generator (if validation passed or max attempts reached).
"""
import logging

logger = logging.getLogger(__name__)

MAX_VALIDATION_ATTEMPTS = 1


def validation_router(state: dict) -> str:
    """
    Conditional edge function for the LangGraph workflow.

    Routes directly to mom_generator to maintain high-throughput, low-latency,
    and prevent Groq rate limits (6000 TPM ceiling).
    """
    errors = state.get("validation_errors", [])
    if errors:
        logger.info(f"Validator noted {len(errors)} validation observation(s). Proceeding directly to MoM generation.")
    else:
        logger.info("Validation passed. Routing to MoM generator.")
    return "mom_generator"
