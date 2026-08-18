"""
Transcript cleaner utility.
Removes filler words, normalizes whitespace, and formats transcripts for LLM processing.
"""
import re


FILLER_WORDS = [
    r"\bum+\b", r"\buh+\b", r"\bhmm+\b", r"\blike\b(?=\s+(?:I|you|he|she|we|they|it))",
    r"\byou know\b", r"\bI mean\b", r"\bkind of\b", r"\bsort of\b",
]


def remove_filler_words(text: str) -> str:
    """Remove common spoken filler words from transcript."""
    for pattern in FILLER_WORDS:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    return text


def normalize_whitespace(text: str) -> str:
    """Collapse multiple spaces and normalize line endings."""
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def capitalize_sentences(text: str) -> str:
    """Ensure each sentence starts with a capital letter."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(s[0].upper() + s[1:] if s else s for s in sentences)


def clean_transcript(raw_transcript: str) -> str:
    """
    Full cleaning pipeline for raw meeting transcripts.

    Steps:
    1. Remove excessive filler words.
    2. Normalize whitespace.
    3. Capitalize sentence starts.

    Args:
        raw_transcript: Raw text from Whisper STT.

    Returns:
        Cleaned, readable transcript.
    """
    if not raw_transcript:
        return ""

    text = remove_filler_words(raw_transcript)
    text = normalize_whitespace(text)
    text = capitalize_sentences(text)
    return text
