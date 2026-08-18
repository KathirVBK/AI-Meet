"""
Speaker Name Detection Module.
Analyzes the first few minutes of a diarized meeting transcript to detect
participant self-introductions (e.g., "Hi, I'm Kathir.", "My name is Rahul.")
and automatically maps Speaker labels to real names. If no introduction is
found, the original Speaker N label is preserved.
"""
import re
import logging
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Data structures
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class SpeakerNameMapping:
    """
    Mapping from speaker labels (Speaker 1, Speaker 2, ...) to real names,
    plus the list of unique participant names for downstream use.
    """
    label_to_name: Dict[str, str] = field(default_factory=dict)  # e.g., {"Speaker 1": "Kathir"}
    name_to_label: Dict[str, str] = field(default_factory=dict)  # reverse map for lookup
    participants: List[str] = field(default_factory=list)        # deduplicated name list
    detection_method: Dict[str, str] = field(default_factory=dict)  # which pattern matched per speaker
    unresolved_speakers: List[str] = field(default_factory=list)    # still "Speaker N"

    def get_display_name(self, speaker_label: str) -> str:
        """Return the real name if known, otherwise the original label."""
        return self.label_to_name.get(speaker_label, speaker_label)

    def to_dict(self) -> Dict:
        return {
            "label_to_name": self.label_to_name,
            "name_to_label": self.name_to_label,
            "participants": self.participants,
            "detection_method": self.detection_method,
            "unresolved_speakers": self.unresolved_speakers,
        }


# ──────────────────────────────────────────────────────────────────────────────
# Introduction pattern definitions
# ──────────────────────────────────────────────────────────────────────────────

# Regex patterns that capture a person introducing themselves.
# Each pattern uses a named group (?P<name>...) to isolate the first token(s)
# of the name. We intentionally capture 1-2 title-cased tokens so that
# "Priya Raj" or "Jean-Luc" survive but trailing punctuation / sentences do not.
INTRO_PATTERNS: List[Tuple[str, str]] = [
    # Pattern name, regex
    (
        "i_am_apostrophe",
        r"""
        I'm\s+(?P<name>[A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,2})
        (?:[\s\.,;!?]|$)
        """,
    ),
    (
        "i_am_full",
        r"""
        I\s+am\s+(?P<name>[A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,2})
        (?:[\s\.,;!?]|$)
        """,
    ),
    (
        "my_name_is",
        r"""
        [Mm]y\s+name\s+is\s+(?P<name>[A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,2})
        (?:[\s\.,;!?]|$)
        """,
    ),
    (
        "this_is",
        r"""
        [Tt]his\s+is\s+(?P<name>[A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,2})
        (?:[\s\.,;!?]|$)
        """,
    ),
    (
        "call_me",
        r"""
        [Cc]all\s+me\s+(?P<name>[A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,2})
        (?:[\s\.,;!?]|$)
        """,
    ),
    (
        "hi_name",
        r"""
        ^[Hh]i(?:\s+everyone)?[,!\s\.]+(?P<name>[A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,2})
        (?:[\s\.,;!?]|$)
        """,
    ),
    (
        "hey_name",
        r"""
        ^[Hh]ey(?:\s+guys)?[,!\s\.]+(?P<name>[A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,2})
        (?:[\s\.,;!?]|$)
        """,
    ),
    (
        "hello_i_am",
        r"""
        [Hh]ello[,!\s\.]+I(?:'m|\s+am)\s+(?P<name>[A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,2})
        (?:[\s\.,;!?]|$)
        """,
    ),
]

# Compile patterns once with VERBOSE + IGNORECASE where appropriate
_COMPILED_PATTERNS: List[Tuple[str, re.Pattern]] = []
for name, pattern in INTRO_PATTERNS:
    try:
        _COMPILED_PATTERNS.append((name, re.compile(pattern, re.VERBOSE)))
    except re.error as e:
        logger.error("Failed to compile pattern %s: %s", name, e)

# Words that look like a name start but are almost always false positives.
_NAME_STOPWORDS = {
    "The", "A", "An", "This", "That", "These", "Those", "Here", "There",
    "Good", "Great", "Nice", "So", "Well", "Yes", "No", "Sure", "Thanks",
    "Thank", "Okay", "Right", "Now", "Just", "Hi", "Hey", "Hello",
    "Sorry", "Excuse", "Please", "Maybe", "Probably", "Actually",
}


def _is_plausible_name(candidate: str) -> bool:
    """
    Very lightweight sanity check for a captured name candidate.
    Rejects obvious stopwords and ensures at least one alphabetic letter.
    """
    candidate = candidate.strip()
    if not candidate:
        return False
    first_token = candidate.split()[0] if candidate.split() else ""
    if first_token in _NAME_STOPWORDS:
        return False
    # Must start with uppercase and contain only letters/hyphens/apostrophes/spaces
    if not re.match(r"^[A-Z][a-zA-Z\-'\s]+$", candidate):
        return False
    return True


# ──────────────────────────────────────────────────────────────────────────────
# Core detection logic
# ──────────────────────────────────────────────────────────────────────────────

def _sample_intro_window(
    segments: List[dict],
    max_time_seconds: float = 180.0,
    max_segments: int = 40,
) -> List[dict]:
    """
    Select only the early portion of the meeting for intro scanning.
    Scans either the first N segments or the first T seconds, whichever is smaller.

    Args:
        segments: List of segment dicts with keys speaker_label, start_time, text
        max_time_seconds: How many seconds into the meeting to scan (default 3 min).
        max_segments: Hard cap on number of segments scanned.
    """
    window = []
    for seg in segments:
        start = float(seg.get("start_time", 0.0))
        if start > max_time_seconds:
            break
        if len(window) >= max_segments:
            break
        window.append(seg)
    return window


def _search_segment_for_intro(segment_text: str) -> Optional[Tuple[str, str]]:
    """
    Scan a single segment's text against all introduction patterns.
    Returns (pattern_name, cleaned_name) on first match, or None.
    """
    text = segment_text.strip()
    if not text:
        return None

    for pattern_name, regex in _COMPILED_PATTERNS:
        match = regex.search(text)
        if match:
            candidate = match.group("name").strip()
            # Strip trailing sentence fragments (keep up to first non-name token)
            candidate = re.sub(r"[\.,;!?].*$", "", candidate).strip()
            if _is_plausible_name(candidate):
                logger.debug("Intro match [%s]: '%s' -> '%s'", pattern_name, text[:80], candidate)
                return pattern_name, candidate
    return None


def detect_speaker_names(
    diarized_segments: List[dict],
    known_speaker_labels: Optional[List[str]] = None,
    max_intro_time_seconds: float = 180.0,
) -> SpeakerNameMapping:
    """
    Detect participant names from self-introductions in the early transcript.

    Args:
        diarized_segments: List of segment dicts, each containing
            {"speaker_label": "Speaker 1", "start_time": 0.0, "end_time": 5.0, "text": "..."}
        known_speaker_labels: Optional precomputed list of unique speaker labels
            (e.g., ["Speaker 1", "Speaker 2"]). If None, derived from segments.
        max_intro_time_seconds: How far into the meeting to scan for introductions.

    Returns:
        SpeakerNameMapping with label->name mapping and participants list.
    """
    mapping = SpeakerNameMapping()

    if not diarized_segments:
        logger.warning("No diarized segments provided for name detection.")
        return mapping

    # Determine unique speaker set
    if known_speaker_labels:
        unique_labels = list(dict.fromkeys(known_speaker_labels))  # dedupe, preserve order
    else:
        unique_labels = list(dict.fromkeys(seg.get("speaker_label", "Speaker 1") for seg in diarized_segments))

    # Initialize with identity mapping: Speaker 1 -> Speaker 1, etc.
    for label in unique_labels:
        mapping.label_to_name[label] = label
        mapping.unresolved_speakers.append(label)

    # Restrict to intro window
    intro_segments = _sample_intro_window(
        diarized_segments,
        max_time_seconds=max_intro_time_seconds,
    )
    logger.info("Scanning %d early segments (out of %d) for introductions...",
                len(intro_segments), len(diarized_segments))

    matched: Dict[str, str] = {}  # speaker_label -> detected name
    methods: Dict[str, str] = {}
    already_assigned_names: set = set()

    # Pass 1: first-introduction-per-speaker wins
    for seg in intro_segments:
        label = seg.get("speaker_label", "Speaker 1")
        text = seg.get("text", "")

        # If we already identified this speaker, skip (first match wins)
        if label in matched:
            continue

        result = _search_segment_for_intro(text)
        if result is None:
            continue

        pattern_name, name = result

        # Avoid duplicate name assignments if possible
        if name in already_assigned_names:
            logger.info("Name '%s' already mapped; still accepting for '%s' but may require review.",
                        name, label)

        matched[label] = name
        methods[label] = pattern_name
        already_assigned_names.add(name)
        logger.info("Detected %s = %s (pattern: %s)", label, name, pattern_name)

    # Apply detected matches to the mapping object
    participants: List[str] = []
    for label in unique_labels:
        if label in matched:
            name = matched[label]
            mapping.label_to_name[label] = name
            mapping.name_to_label[name] = label
            mapping.detection_method[label] = methods[label]
            mapping.unresolved_speakers = [s for s in mapping.unresolved_speakers if s != label]
            participants.append(name)
        else:
            # No introduction detected; keep generic label
            participants.append(label)

    mapping.participants = list(dict.fromkeys(participants))  # stable dedupe
    logger.info("Name detection complete. %d/%d speakers identified.",
                len(unique_labels) - len(mapping.unresolved_speakers),
                len(unique_labels))
    logger.info("Participants: %s", mapping.participants)
    return mapping


# ──────────────────────────────────────────────────────────────────────────────
# LLM-assisted fallback (optional) for trickier introductions
# ──────────────────────────────────────────────────────────────────────────────

def detect_speaker_names_with_llm(
    diarized_segments: List[dict],
    llm_client,
    max_intro_time_seconds: float = 180.0,
) -> SpeakerNameMapping:
    """
    Second-pass name detection that uses an LLM to re-scan the intro window
    when regex-based detection left some speakers unresolved. Useful when
    introductions are very colloquial.

    Args:
        diarized_segments: Diarized segments as in detect_speaker_names().
        llm_client: Any LangChain-compatible ChatModel with .invoke().
        max_intro_time_seconds: Intro window length in seconds.

    Returns:
        SpeakerNameMapping (may still have unresolved speakers if LLM can't help).
    """
    # Start with regex results so we never regress
    regex_mapping = detect_speaker_names(
        diarized_segments, max_intro_time_seconds=max_intro_time_seconds,
    )
    if not regex_mapping.unresolved_speakers:
        return regex_mapping

    intro_window = _sample_intro_window(diarized_segments, max_time_seconds=max_intro_time_seconds)
    unresolved = regex_mapping.unresolved_speakers

    prompt_lines = [
        "You are parsing meeting introductions. The following transcript window contains",
        "the start of a meeting with speakers labelled as Speaker 1, Speaker 2, etc.",
        "Some of them introduce themselves. Your job is to produce a JSON object mapping",
        "speaker labels -> real names ONLY for the speakers that clearly introduced themselves.",
        "",
        "RULES:",
        "1. Only return speakers you are HIGHLY confident actually stated their name.",
        "2. If a speaker was not introduced, do NOT guess — omit them.",
        "3. Output ONLY valid JSON, no extra text.",
        "4. Format example: {\"Speaker 1\": \"Alice\", \"Speaker 3\": \"Bob\"}",
        "",
        f"Speakers that still need identification: {unresolved}",
        "",
        "TRANSCRIPT WINDOW:",
    ]
    for seg in intro_window:
        prompt_lines.append(f"[{seg.get('speaker_label','?')}] {seg.get('text','')}")
    prompt_text = "\n".join(prompt_lines)

    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser
        import json

        tpl = ChatPromptTemplate.from_messages([("user", "{text}")])
        chain = tpl | llm_client | StrOutputParser()
        raw = chain.invoke({"text": prompt_text})
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").replace("json", "", 1).strip()
        try:
            inferred = json.loads(cleaned)
        except Exception:
            inferred = {}

        if isinstance(inferred, dict):
            for label, name in inferred.items():
                if label in regex_mapping.unresolved_speakers and isinstance(name, str):
                    name = name.strip()
                    if _is_plausible_name(name):
                        regex_mapping.label_to_name[label] = name
                        regex_mapping.name_to_label[name] = label
                        regex_mapping.detection_method[label] = "llm_fallback"
                        regex_mapping.unresolved_speakers = [s for s in regex_mapping.unresolved_speakers if s != label]
                        if name not in regex_mapping.participants:
                            regex_mapping.participants.append(name)
            logger.info("LLM fallback extended mapping: %s unresolved remain.",
                        len(regex_mapping.unresolved_speakers))
    except Exception as e:
        logger.warning("LLM-assisted name detection skipped / failed: %s", e)

    return regex_mapping
