"""
Conversation memory for the RAG Q&A chat.
Maintains a sliding window of recent Q&A exchanges in Streamlit session state.
"""
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

MAX_MEMORY_TURNS = 10  # keep last N exchanges


def get_chat_history(session_state) -> List[dict]:
    """
    Return the chat history list from session state.
    Each entry: {"role": "user"|"assistant", "content": "..."}
    """
    if "chat_messages" not in session_state:
        session_state["chat_messages"] = []
    return session_state["chat_messages"]


def add_user_message(session_state, message: str):
    """Add a user message to the chat history."""
    history = get_chat_history(session_state)
    history.append({"role": "user", "content": message})
    _trim(session_state)


def add_assistant_message(session_state, message: str):
    """Add an assistant message to the chat history."""
    history = get_chat_history(session_state)
    history.append({"role": "assistant", "content": message})
    _trim(session_state)


def format_chat_history_for_prompt(session_state) -> str:
    """
    Format recent chat history as a string suitable for injection into the RAG prompt.
    Returns an empty string if there is no prior conversation.
    """
    history = get_chat_history(session_state)
    if not history:
        return ""

    # Only include the last few exchanges (not the current question)
    # We exclude the very last user message because it's the current question
    past = history[:-1] if history and history[-1]["role"] == "user" else history

    if not past:
        return ""

    lines = []
    for msg in past[-(MAX_MEMORY_TURNS * 2):]:
        role_label = "User" if msg["role"] == "user" else "Assistant"
        lines.append(f"{role_label}: {msg['content']}")

    return "\n".join(lines)


def clear_chat_history(session_state):
    """Clear all chat history."""
    session_state["chat_messages"] = []
    logger.info("Chat history cleared.")


def _trim(session_state):
    """Keep only the last MAX_MEMORY_TURNS * 2 messages (user + assistant pairs)."""
    history = get_chat_history(session_state)
    max_msgs = MAX_MEMORY_TURNS * 2
    if len(history) > max_msgs:
        session_state["chat_messages"] = history[-max_msgs:]
