"""
LangGraph conditional router.
Determines whether to route to the reanalyzer (if validation errors exist)
or to the MoM generator (if validation passed or max attempts reached).
"""
import logging

logger = logging.getLogger(__name__)

MAX_VALIDATION_ATTEMPTS = 3


def validation_router(state: dict) -> str:
    """
    Conditional edge function for the LangGraph workflow.

    Routes to:
    - 'reanalyzer': If there are validation errors and attempts < MAX_VALIDATION_ATTEMPTS
    - 'mom_generator': If validation passed or max attempts reached

    Args:
        state: Current LangGraph state dict.

    Returns:
        String name of the next node to execute.
    """
    errors = state.get("validation_errors", [])
    attempts = state.get("validation_attempts", 0)

    if errors and attempts < MAX_VALIDATION_ATTEMPTS:
        logger.info(
            f"Validation failed with {len(errors)} error(s). "
            f"Routing to reanalyzer (attempt {attempts + 1}/{MAX_VALIDATION_ATTEMPTS})."
        )
        return "reanalyzer"
    else:
        if attempts >= MAX_VALIDATION_ATTEMPTS:
            logger.warning(
                f"Max validation attempts ({MAX_VALIDATION_ATTEMPTS}) reached. "
                "Proceeding to MoM generation with best available data."
            )
        else:
            logger.info("Validation passed. Routing to MoM generator.")
        return "mom_generator"
