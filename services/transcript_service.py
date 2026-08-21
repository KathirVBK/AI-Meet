"""
Transcript service.
Orchestrates the full speech-processing pipeline:

    Audio → (optional) convert/chunk
          → Detailed transcription (with word timestamps)
          → Speaker diarization
          → Speaker-name detection from introductions
          → Transcript reconstruction (speaker turns + names)
          → Clean plain-text transcript (for backward compatibility)

The detailed results (speaker segments, participants, mapping, labelled text)
are bundled into a TranscriptPipelineResult so that api_server.py and the
LangGraph workflow can use them directly.
"""
import os
import logging
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any, TypedDict

from services.audio_processor import (
    prepare_audio_for_transcription,
    cleanup_temp_files,
    get_audio_duration_ms,
    CHUNK_DURATION_MS,
)
from services.speech_to_text import (
    transcribe_audio_chunks,
    transcribe_audio_file_detailed,
    transcribe_audio_chunks_detailed,
    TranscriptionResult,
)
from services.speaker_diarization import (
    diarize_audio,
    DiarizationResult,
)
from services.speaker_name_detector import (
    detect_speaker_names,
    SpeakerNameMapping,
)
from services.transcript_reconstructor import (
    reconstruct_transcript,
    ReconstructedTranscript,
    build_llm_context_transcript,
)
from utils.transcript_cleaner import clean_transcript

logger = logging.getLogger(__name__)

TRANSCRIPTS_DIR = "./data/transcripts"


# ──────────────────────────────────────────────────────────────────────────────
# Output structure
# ──────────────────────────────────────────────────────────────────────────────

class TranscriptPipelineResult(TypedDict, total=False):
    """Everything the rest of the application needs post transcription."""
    plain_text: str                         # backward-compat cleaned transcript
    labelled_text: str                      # "Speaker Name:\n text \n Speaker 2:\n..."
    segments: List[Dict[str, Any]]          # structured speaker turns
    participants: List[str]                 # resolved participant names
    speaker_mapping: Dict[str, str]         # Speaker N -> real name (may be identity)
    diarization: Dict[str, Any]             # raw-ish diarization result (for debugging)
    backend_used: str                       # which STT backend ran
    word_count: int


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _try_find_wav_path(input_path: str, temp_dir: str) -> str:
    """Return the path preferred for diarization (wav if possible, else original)."""
    ext = Path(input_path).suffix.lower()
    if ext == ".wav":
        return input_path
    # Otherwise, maybe audio_processor already produced a wav in the temp dir with the same stem.
    candidate = Path(temp_dir) / f"{Path(input_path).stem}.wav"
    if candidate.exists():
        return str(candidate)
    return input_path


def _save_all_transcripts(
    stem: str,
    plain_text: str,
    labelled_text: str,
    segments: List[Dict[str, Any]],
) -> None:
    os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
    plain_path = os.path.join(TRANSCRIPTS_DIR, f"{stem}_transcript.txt")
    labelled_path = os.path.join(TRANSCRIPTS_DIR, f"{stem}_transcript_labelled.txt")
    segments_path = os.path.join(TRANSCRIPTS_DIR, f"{stem}_segments.json")

    with open(plain_path, "w", encoding="utf-8") as f:
        f.write(plain_text)
    logger.info("Plain transcript saved: %s", plain_path)

    with open(labelled_path, "w", encoding="utf-8") as f:
        f.write(labelled_text)
    logger.info("Labelled transcript saved: %s", labelled_path)

    try:
        import json
        with open(segments_path, "w", encoding="utf-8") as f:
            json.dump(segments, f, indent=2, ensure_ascii=False)
        logger.info("Segments saved: %s", segments_path)
    except Exception as e:
        logger.warning("Could not save segments JSON: %s", e)


# ──────────────────────────────────────────────────────────────────────────────
# Legacy entry point (preserves backward compatibility)
# ──────────────────────────────────────────────────────────────────────────────

def process_and_transcribe(
    audio_file_path: str,
    language: str = "en",
    save_transcript: bool = True,
    meeting_name: Optional[str] = None,
) -> str:
    """
    Legacy / backward-compatible entry point: returns cleaned plain transcript only.
    Internally uses the new pipeline where possible so that speaker data is
    produced whenever the dependencies allow.
    """
    result = process_audio_full_pipeline(
        audio_file_path=audio_file_path,
        language=language,
        save_transcript=save_transcript,
        meeting_name=meeting_name,
    )
    return result.get("plain_text", "")


def load_transcript_from_file(transcript_path: str) -> str:
    """Load a previously saved plain-text transcript from disk."""
    with open(transcript_path, "r", encoding="utf-8") as f:
        return f.read()


# ──────────────────────────────────────────────────────────────────────────────
# New full pipeline entry point
# ──────────────────────────────────────────────────────────────────────────────

def process_audio_full_pipeline(
    audio_file_path: str,
    language: str = "en",
    save_transcript: bool = True,
    meeting_name: Optional[str] = None,
    diarization_method: str = "auto",
    num_speakers_hint: Optional[int] = None,
) -> TranscriptPipelineResult:
    """
    End-to-end audio → detailed transcript pipeline with speaker attribution.

    Steps:
      1. Prepare audio (convert to wav + split if too big for API limits)
      2. Detailed STT with word-level timestamps where possible
      3. Speaker diarization (Pyannote → WhisperX → fallback)
      4. Name detection from first 3 minutes of transcript
      5. Reconstruction of speaker turns with proper names + text alignment
      6. Cleaned output artefacts + persistence

    Args:
        audio_file_path: Path to the uploaded audio file.
        language: Language code for transcription.
        save_transcript: If True, writes plain + labelled transcripts to disk.
        meeting_name: Optional stem for saved transcripts.
        diarization_method: "auto", "pyannote", "whisperx", or "fallback".
        num_speakers_hint: Optional hint for the number of speakers.

    Returns:
        TranscriptPipelineResult with plain_text, labelled_text, segments,
        participants, speaker_mapping.
    """
    os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
    temp_dir = "./data/audio"
    os.makedirs(temp_dir, exist_ok=True)

    logger.info("=== Starting full speaker-aware transcription pipeline ===")
    logger.info("Input audio : %s", audio_file_path)
    logger.info("Language    : %s", language)

    file_stem = meeting_name or Path(audio_file_path).stem
    if not os.path.exists(audio_file_path):
        raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

    # ── Step 1: Prepare audio ──────────────────────────────────────────────
    # NOTE: prepare_audio_for_transcription produces chunk paths that are
    # compliant with the old Groq 25MB API limit. For local WhisperX/Pyannote,
    # we still run the conversion to wav but PREFER to diarize/transcribe the
    # combined wav (single file) because it yields much better speaker turn
    # boundaries.
    try:
        chunk_paths = prepare_audio_for_transcription(audio_file_path, temp_dir)
    except Exception as e:
        logger.warning("Audio prepare step failed (%s); proceeding with raw file.", e)
        chunk_paths = [audio_file_path]

    # Preferred wav path for diarization (may or may not equal input)
    wav_for_diarization = _try_find_wav_path(audio_file_path, temp_dir)

    # ── Step 2: Detailed STT ───────────────────────────────────────────────
    # For long recordings, prefer chunked transcription first so we avoid depending
    # on a single long-file pass that may exceed backend limits.
    transcription: Optional[TranscriptionResult] = None
    should_use_chunked_stt = False
    try:
        duration_ms = get_audio_duration_ms(wav_for_diarization)
        should_use_chunked_stt = duration_ms > CHUNK_DURATION_MS
    except Exception as e:
        logger.warning("Could not estimate audio duration for STT routing: %s", e)

    try:
        if should_use_chunked_stt:
            logger.info("Using chunked STT for long recording (%s min).", round(CHUNK_DURATION_MS / 60000, 1))
            transcription = transcribe_audio_chunks_detailed(chunk_paths, language=language)
        else:
            transcription = transcribe_audio_file_detailed(
                wav_for_diarization, language=language, include_word_timestamps=True,
            )
        logger.info("Detailed STT completed with backend=%s, %d words.",
                    transcription.get("backend_used", "?"),
                    len(transcription.get("words", [])))
    except Exception as e:
        logger.warning("Primary STT path failed (%s); falling back to alternate path.", e)
        try:
            if should_use_chunked_stt:
                transcription = transcribe_audio_file_detailed(
                    wav_for_diarization, language=language, include_word_timestamps=True,
                )
            else:
                transcription = transcribe_audio_chunks_detailed(chunk_paths, language=language)
        except Exception as e2:
            logger.warning("Alternate STT path also failed (%s); using plain chunks.", e2)

    # If detailed STT really failed, at least give us plain text the old way.
    if transcription is None:
        plain_text = transcribe_audio_chunks(chunk_paths, language=language)
        transcription = TranscriptionResult(
            text=plain_text,
            segments=[],
            words=[],
            language=language,
            backend_used="groq_plain",
            diarization_segments=None,
        )

    # ── Step 3: Diarization ────────────────────────────────────────────────
    diarization: Optional[DiarizationResult] = None
    if transcription.get("diarization_segments"):
        # WhisperX already diarized inline — reuse
        logger.info("Reusing inline diarization from WhisperX (%d segments).",
                    len(transcription["diarization_segments"]))
        from services.speaker_diarization import DiarizationResult as DR, SpeakerSegment as SS
        segs = [
            SS(
                speaker_id=s.get("speaker_id", f"SPEAKER_{i:02d}"),
                speaker_label=s.get("speaker_label", f"Speaker {i+1}"),
                start_time=float(s.get("start_time", 0.0)),
                end_time=float(s.get("end_time", 0.0)),
                text="",
            )
            for i, s in enumerate(transcription["diarization_segments"])
        ]
        unique_labels = list(dict.fromkeys(s.speaker_label for s in segs))
        diarization = DR(segments=segs, unique_speakers=unique_labels, speaker_count=len(unique_labels))

    if diarization is None:
        try:
            diarization = diarize_audio(
                wav_for_diarization,
                method=diarization_method,
                num_speakers=num_speakers_hint,
            )
        except Exception as e:
            logger.warning("Diarization failed (%s); using single-speaker fallback.", e)
            from services.speaker_diarization import _fallback_single_speaker_diarization
            diarization = _fallback_single_speaker_diarization(wav_for_diarization)

    diarization_dict = diarization.to_dict()
    logger.info("Diarization: %d speaker(s), %d segment(s).",
                diarization.speaker_count, len(diarization.segments))

    # ── Step 4: Reconstruct transcript with text aligned to speaker turns ──
    # Before name detection we need the text attached to each segment so that
    # the name detector can scan "Speaker 1 turns" for introductions.
    word_timestamps = transcription.get("words") or None
    raw_text = transcription.get("text", "")
    diarization_segments_plain = [s.to_dict() for s in diarization.segments]

    # Build a preliminary reconstruction to feed the name detector.
    temp_reconstructed: ReconstructedTranscript = reconstruct_transcript(
        raw_transcript_text=raw_text,
        diarization_segments=diarization_segments_plain,
        speaker_name_mapping={s: s for s in diarization.unique_speakers},  # identity for now
        participants=list(diarization.unique_speakers),
        word_timestamps=word_timestamps,
        merge_consecutive=True,
    )

    # ── Step 5: Name detection from introductions ──────────────────────────
    segments_for_detector = [
        {
            "speaker_label": seg.speaker_label,
            "start_time": seg.start_time,
            "end_time": seg.end_time,
            "text": seg.text,
        }
        for seg in temp_reconstructed.segments
    ]
    name_mapping: SpeakerNameMapping = detect_speaker_names(
        segments_for_detector,
        known_speaker_labels=list(diarization.unique_speakers),
        max_intro_time_seconds=180.0,
    )
    logger.info("Speaker-name mapping: %s", name_mapping.label_to_name)

    # ── Step 6: Final reconstruction (with names applied) ─────────────────
    final_reconstructed: ReconstructedTranscript = reconstruct_transcript(
        raw_transcript_text=raw_text,
        diarization_segments=diarization_segments_plain,
        speaker_name_mapping=name_mapping.label_to_name,
        participants=name_mapping.participants,
        word_timestamps=word_timestamps,
        merge_consecutive=True,
    )

    labelled_text = build_llm_context_transcript(
        final_reconstructed, use_names=True, include_timestamps=True,
    )
    plain_text = clean_transcript(final_reconstructed.raw_text or raw_text)

    segments_out = [seg.to_dict() for seg in final_reconstructed.segments]

    # ── Step 7: Persist artefacts if requested ─────────────────────────────
    if save_transcript:
        _save_all_transcripts(
            stem=file_stem,
            plain_text=plain_text,
            labelled_text=labelled_text,
            segments=segments_out,
        )

    # ── Step 8: Cleanup temp chunk files ───────────────────────────────────
    try:
        cleanup_temp_files(chunk_paths)
    except Exception as e:
        logger.warning("Temp cleanup issue: %s", e)

    logger.info("=== Full pipeline complete ===")
    logger.info("Participants  : %s", name_mapping.participants)
    logger.info("Segments out  : %d", len(segments_out))
    logger.info("Backend used  : %s", transcription.get("backend_used", "?"))

    return TranscriptPipelineResult(
        plain_text=plain_text,
        labelled_text=labelled_text,
        segments=segments_out,
        participants=list(name_mapping.participants),
        speaker_mapping=dict(name_mapping.label_to_name),
        diarization=diarization_dict,
        backend_used=transcription.get("backend_used", "unknown"),
        word_count=len(plain_text.split()),
    )
