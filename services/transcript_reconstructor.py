"""
Transcript Reconstruction Module.
Combines the outputs of:
  1. Speech-to-text transcription (with optional word-level timestamps)
  2. Speaker diarization (Speaker 1, Speaker 2, ...)
  3. Speaker name mapping (Speaker 1 -> Kathir)

to produce:
  - A human-readable transcript with speaker labels / real names
  - A structured list of segments with timing, speaker, and text
    that can be fed into the LLM for intelligent task assignment.
"""
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Data structures
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class ReconstructedSegment:
    """One turn of speech, fully attributed to a (possibly named) speaker."""
    index: int
    speaker_label: str           # e.g., "Speaker 1"
    speaker_name: str            # e.g., "Kathir" (falls back to speaker_label if unknown)
    start_time: float            # seconds
    end_time: float              # seconds
    text: str                    # attributed transcript text for this turn
    words: List[Dict[str, Any]] = field(default_factory=list)  # optional word-level info

    def format_turn(self, use_names: bool = True) -> str:
        who = self.speaker_name if use_names else self.speaker_label
        return f"{who}:\n{self.text.strip()}\n"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "speaker_label": self.speaker_label,
            "speaker_name": self.speaker_name,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "text": self.text,
        }


@dataclass
class ReconstructedTranscript:
    """Complete reconstructed transcript for a meeting."""
    segments: List[ReconstructedSegment] = field(default_factory=list)
    participants: List[str] = field(default_factory=list)
    speaker_mapping: Dict[str, str] = field(default_factory=dict)  # Speaker 1 -> Kathir
    raw_text: str = ""  # plain text without speaker lines (for backward compat)
    labelled_text: str = ""  # text with "Speaker Name:\n text" lines

    def to_dict(self) -> Dict[str, Any]:
        return {
            "segments": [s.to_dict() for s in self.segments],
            "participants": self.participants,
            "speaker_mapping": self.speaker_mapping,
            "raw_text": self.raw_text,
            "labelled_text": self.labelled_text,
        }


# ──────────────────────────────────────────────────────────────────────────────
# Alignment helpers
# ──────────────────────────────────────────────────────────────────────────────

def _assign_words_to_diarization_segments(
    word_timestamps: List[Dict[str, Any]],
    diarization_segments: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Given Whisper-style word timestamps (list of {"word":..., "start":..., "end":...})
    and diarization segments (list of {"speaker_label":..., "start_time":..., "end_time":...}),
    assign each word to the diarization segment whose window contains the word's midpoint.

    Words that don't fall within any segment are attached to the nearest segment.
    Returns a new list of diarization segments with an extra "words" field.
    """
    if not diarization_segments:
        return []

    # Make a mutable copy
    out_segs = [dict(s) for s in diarization_segments]
    for s in out_segs:
        s.setdefault("words", [])

    if not word_timestamps:
        return out_segs

    for word in word_timestamps:
        ws = float(word.get("start", word.get("start_time", 0.0)))
        we = float(word.get("end", word.get("end_time", ws)))
        mid = (ws + we) / 2.0

        # Find segment containing mid
        assigned_idx = None
        for i, seg in enumerate(out_segs):
            ss = float(seg.get("start_time", 0.0))
            se = float(seg.get("end_time", 0.0))
            if ss <= mid <= se:
                assigned_idx = i
                break

        if assigned_idx is None:
            # Nearest segment fallback
            best_idx = 0
            best_dist = float("inf")
            for i, seg in enumerate(out_segs):
                ss = float(seg.get("start_time", 0.0))
                se = float(seg.get("end_time", 0.0))
                dist = min(abs(mid - ss), abs(mid - se))
                if dist < best_dist:
                    best_dist = dist
                    best_idx = i
            assigned_idx = best_idx

        out_segs[assigned_idx]["words"].append(word)

    # Concatenate words into segment text
    for seg in out_segs:
        words = [w.get("word", "").strip() for w in seg.get("words", []) if w.get("word", "").strip()]
        seg["text"] = " ".join(words)
    return out_segs


def _merge_consecutive_same_speaker(
    segments: List[ReconstructedSegment],
    gap_threshold_seconds: float = 0.5,
) -> List[ReconstructedSegment]:
    """
    Merge consecutive segments with the same speaker into a single turn.
    Improves readability of the final transcript.
    """
    if not segments:
        return []

    merged: List[ReconstructedSegment] = []
    current: Optional[ReconstructedSegment] = None

    for seg in segments:
        if (current is not None
                and current.speaker_label == seg.speaker_label
                and (seg.start_time - current.end_time) <= gap_threshold_seconds):
            # Merge
            current.end_time = max(current.end_time, seg.end_time)
            if seg.text.strip():
                current.text = (current.text.rstrip() + " " + seg.text.strip()).strip()
            current.words.extend(seg.words)
        else:
            if current is not None:
                merged.append(current)
            current = ReconstructedSegment(
                index=len(merged),
                speaker_label=seg.speaker_label,
                speaker_name=seg.speaker_name,
                start_time=seg.start_time,
                end_time=seg.end_time,
                text=seg.text,
                words=list(seg.words),
            )
    if current is not None:
        merged.append(current)

    # Re-index
    for i, seg in enumerate(merged):
        seg.index = i
    logger.info("Merged %d segments into %d speaker turns.", len(segments), len(merged))
    return merged


def _chunk_text_by_timestamps_greedy(
    raw_transcript_text: str,
    diarization_segments: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    When no word timestamps are available, distribute transcript text across
    diarization segments proportionally to segment duration vs. total duration.
    This is an approximation; word-level timestamps are strongly preferred.
    """
    import math

    if not raw_transcript_text:
        for s in diarization_segments:
            s["text"] = ""
        return diarization_segments

    tokens = re.split(r"(\s+)", raw_transcript_text)  # keep whitespace
    total_tokens = len(tokens)
    total_duration = max(
        sum(float(s.get("end_time", 0.0)) - float(s.get("start_time", 0.0)) for s in diarization_segments),
        0.001,
    )

    cursor = 0
    for seg in diarization_segments:
        dur = float(seg.get("end_time", 0.0)) - float(seg.get("start_time", 0.0))
        frac = max(0.0, min(1.0, dur / total_duration))
        take = int(math.ceil(total_tokens * frac))
        chunk = tokens[cursor: cursor + take]
        seg["text"] = "".join(chunk).strip()
        cursor += take
    # Attach any leftover tokens to the last segment
    if cursor < total_tokens:
        remainder = "".join(tokens[cursor:]).strip()
        if remainder and diarization_segments:
            diarization_segments[-1]["text"] = (
                diarization_segments[-1].get("text", "").rstrip() + " " + remainder
            ).strip()
    return diarization_segments


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def reconstruct_transcript(
    raw_transcript_text: str,
    diarization_segments: List[Dict[str, Any]],
    speaker_name_mapping: Dict[str, str],
    participants: List[str],
    word_timestamps: Optional[List[Dict[str, Any]]] = None,
    merge_consecutive: bool = True,
) -> ReconstructedTranscript:
    """
    Build the final ReconstructedTranscript from its component pieces.

    Args:
        raw_transcript_text: Transcription output (plain string, used for
                             backward-compat + proportional fallback).
        diarization_segments: List of segment dicts from speaker_diarization module.
        speaker_name_mapping: Dict from "Speaker 1" -> real name (may be identity).
        participants: Final participants list for metadata.
        word_timestamps: Optional list of word-level timestamp dicts for precise alignment.
        merge_consecutive: If True, merge adjacent same-speaker segments.

    Returns:
        ReconstructedTranscript with segments, labelled_text, raw_text.
    """
    # Step 1 — align words / text to diarization segments
    if word_timestamps is not None and len(word_timestamps) > 0:
        logger.info("Reconstructing transcript using %d word-level timestamps.", len(word_timestamps))
        enriched = _assign_words_to_diarization_segments(word_timestamps, diarization_segments)
    else:
        logger.info("No word-level timestamps available; using proportional text assignment.")
        enriched = _chunk_text_by_timestamps_greedy(raw_transcript_text, diarization_segments)

    # Step 2 — build segment objects with speaker names resolved
    reconstructed_segments: List[ReconstructedSegment] = []
    for i, seg in enumerate(enriched):
        label = seg.get("speaker_label", f"Speaker {i+1}")
        name = speaker_name_mapping.get(label, label)
        reconstructed_segments.append(ReconstructedSegment(
            index=len(reconstructed_segments),
            speaker_label=label,
            speaker_name=name,
            start_time=float(seg.get("start_time", 0.0)),
            end_time=float(seg.get("end_time", 0.0)),
            text=seg.get("text", ""),
            words=list(seg.get("words", [])),
        ))

    # Step 3 — optional same-speaker merge
    if merge_consecutive:
        reconstructed_segments = _merge_consecutive_same_speaker(reconstructed_segments)

    # Step 4 — drop any empty segments (can happen with misalignment)
    reconstructed_segments = [s for s in reconstructed_segments if s.text.strip()]
    # Re-index after drop
    for i, s in enumerate(reconstructed_segments):
        s.index = i

    # Step 5 — produce aggregate text versions
    raw_chunks = []
    labelled_chunks = []
    for seg in reconstructed_segments:
        t = seg.text.strip()
        if not t:
            continue
        raw_chunks.append(t)
        labelled_chunks.append(seg.format_turn(use_names=True))

    transcript = ReconstructedTranscript(
        segments=reconstructed_segments,
        participants=list(participants),
        speaker_mapping=dict(speaker_name_mapping),
        raw_text="\n".join(raw_chunks),
        labelled_text="\n".join(labelled_chunks),
    )
    logger.info("Transcript reconstruction done: %d segments, %d participants.",
                len(transcript.segments), len(transcript.participants))
    return transcript


def build_llm_context_transcript(
    reconstructed: ReconstructedTranscript,
    use_names: bool = True,
    include_timestamps: bool = False,
) -> str:
    """
    Render the transcript in the format best suited for the LLM prompt.

    Example output (with names, no timestamps):
        Kathir:
        I'll take care of the MC.

        Rahul:
        Kathir will handle the poster.
    """
    lines = []
    for seg in reconstructed.segments:
        who = seg.speaker_name if use_names else seg.speaker_label
        
        if include_timestamps:
            import math
            total_secs = int(math.floor(seg.start_time))
            hours = total_secs // 3600
            minutes = (total_secs % 3600) // 60
            seconds = total_secs % 60
            ts_str = f"[{hours:02d}:{minutes:02d}:{seconds:02d}]"
            header = f"{ts_str} {who}"
        else:
            header = who
            
        lines.append(f"{header}:")
        lines.append(seg.text.strip())
        lines.append("")
    return "\n".join(lines).rstrip()
