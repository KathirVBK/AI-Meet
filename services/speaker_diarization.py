"""
Speaker Diarization Module.
Identifies different speakers in an audio recording using Pyannote Audio's
pre-trained speaker diarization pipeline. Labels speakers as Speaker 1,
Speaker 2, etc., and preserves timestamps for alignment with transcript text.
"""
import os
import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SpeakerSegment:
    """Represents a single speaker turn with timing information."""
    speaker_id: str          # e.g., "SPEAKER_00" or "Speaker 1"
    speaker_label: str       # Human-readable label, e.g., "Speaker 1"
    start_time: float        # Start time in seconds
    end_time: float          # End time in seconds
    text: str = ""           # Transcript text assigned to this segment (filled later)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "speaker_id": self.speaker_id,
            "speaker_label": self.speaker_label,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "text": self.text,
        }


@dataclass
class DiarizationResult:
    """Complete diarization output for an audio file."""
    segments: List[SpeakerSegment] = field(default_factory=list)
    unique_speakers: List[str] = field(default_factory=list)  # e.g., ["Speaker 1", "Speaker 2"]
    speaker_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "segments": [s.to_dict() for s in self.segments],
            "unique_speakers": self.unique_speakers,
            "speaker_count": self.speaker_count,
        }


# ──────────────────────────────────────────────────────────────────────────────
# Pyannote-based diarization (preferred if available + configured)
# ──────────────────────────────────────────────────────────────────────────────

def _get_huggingface_token() -> Optional[str]:
    """
    Retrieve Hugging Face access token from environment or .env file.
    Required for downloading Pyannote models from Hugging Face Hub.
    Users must accept terms at:
      - https://huggingface.co/pyannote/speaker-diarization-3.1
      - https://huggingface.co/pyannote/segmentation-3.0
    """
    from dotenv import load_dotenv
    load_dotenv()
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")
    if token:
        return token
    # Pyannote also reads this env var internally
    return os.getenv("PYANNOTE_AUTH_TOKEN")


def run_pyannote_diarization(audio_path: str, num_speakers: Optional[int] = None) -> DiarizationResult:
    """
    Run speaker diarization using the official Pyannote Audio pipeline.

    Args:
        audio_path: Path to the audio file (wav preferred).
        num_speakers: Optional hint for the number of speakers. If None, the
                      pipeline will try to detect the count automatically.

    Returns:
        DiarizationResult with speaker segments and labels.
    """
    try:
        from pyannote.audio import Pipeline
    except ImportError:
        logger.warning("pyannote.audio is not installed. Falling back to mock diarization.")
        return _fallback_single_speaker_diarization(audio_path)

    auth_token = _get_huggingface_token()
    if not auth_token:
        logger.warning(
            "No Hugging Face token found (HF_TOKEN, HUGGINGFACE_TOKEN, or PYANNOTE_AUTH_TOKEN). "
            "Pyannote models require authentication. Falling back to single-speaker mode."
        )
        return _fallback_single_speaker_diarization(audio_path)

    try:
        logger.info("Loading Pyannote speaker diarization pipeline...")
        # Use the latest V3.1 diarization model. Requires auth token.
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=auth_token,
        )

        # Send to GPU if CUDA is available (Pyannote auto-detects)
        logger.info("Running diarization on audio: %s", audio_path)
        kwargs = {}
        if num_speakers is not None:
            kwargs["num_speakers"] = num_speakers
        diarization = pipeline(audio_path, **kwargs)

        # Convert pyannote Annotation to our structured format
        segments: List[SpeakerSegment] = []
        speaker_id_map: Dict[str, str] = {}
        speaker_counter = 0

        for segment, _, speaker_id in diarization.itertracks(yield_label=True):
            # Map internal SPEAKER_00, SPEAKER_01, etc. to human-friendly Speaker 1..N
            if speaker_id not in speaker_id_map:
                speaker_counter += 1
                speaker_id_map[speaker_id] = f"Speaker {speaker_counter}"

            segments.append(SpeakerSegment(
                speaker_id=speaker_id,
                speaker_label=speaker_id_map[speaker_id],
                start_time=round(segment.start, 3),
                end_time=round(segment.end, 3),
            ))

        unique_speakers = sorted(speaker_id_map.values(),
                                 key=lambda s: int(re.search(r"\d+", s).group()) if re.search(r"\d+", s) else 0)

        result = DiarizationResult(
            segments=segments,
            unique_speakers=unique_speakers,
            speaker_count=len(unique_speakers),
        )
        logger.info("Diarization complete: %d speaker(s), %d segment(s)",
                    result.speaker_count, len(result.segments))
        return result

    except Exception as e:
        logger.error("Pyannote diarization failed: %s. Falling back to single-speaker.", e, exc_info=True)
        return _fallback_single_speaker_diarization(audio_path)


# ──────────────────────────────────────────────────────────────────────────────
# WhisperX-based diarization (alternative: good when WhisperX is preferred)
# ──────────────────────────────────────────────────────────────────────────────

def run_whisperx_diarization(audio_path: str, diarize_model=None) -> DiarizationResult:
    """
    Perform diarization using WhisperX's speaker assignment.
    This is typically called after WhisperX transcription so that words are
    already aligned to speakers; but we expose it as a standalone helper too.

    Args:
        audio_path: Path to audio file.
        diarize_model: Optional pre-loaded WhisperX diarization model instance.

    Returns:
        DiarizationResult.
    """
    try:
        import whisperx
        import torch
    except ImportError:
        logger.warning("WhisperX not available for diarization. Using fallback.")
        return _fallback_single_speaker_diarization(audio_path)

    auth_token = _get_huggingface_token()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    try:
        if diarize_model is None:
            diarize_model = whisperx.DiarizationPipeline(
                use_auth_token=auth_token, device=device
            )

        logger.info("Running WhisperX diarization on %s", audio_path)
        diarize_segments = diarize_model(audio_path)

        segments: List[SpeakerSegment] = []
        speaker_id_map: Dict[str, str] = {}
        speaker_counter = 0

        for seg in diarize_segments.to_dict("records"):
            raw_speaker = seg.get("speaker", "SPEAKER_00")
            if raw_speaker not in speaker_id_map:
                speaker_counter += 1
                speaker_id_map[raw_speaker] = f"Speaker {speaker_counter}"

            segments.append(SpeakerSegment(
                speaker_id=raw_speaker,
                speaker_label=speaker_id_map[raw_speaker],
                start_time=round(float(seg.get("start", 0.0)), 3),
                end_time=round(float(seg.get("end", 0.0)), 3),
            ))

        unique_speakers = sorted(speaker_id_map.values(),
                                 key=lambda s: int(re.search(r"\d+", s).group()) if re.search(r"\d+", s) else 0)

        result = DiarizationResult(
            segments=segments,
            unique_speakers=unique_speakers,
            speaker_count=len(unique_speakers),
        )
        logger.info("WhisperX diarization complete: %d speaker(s), %d segment(s)",
                    result.speaker_count, len(result.segments))
        return result

    except Exception as e:
        logger.error("WhisperX diarization failed: %s", e, exc_info=True)
        return _fallback_single_speaker_diarization(audio_path)


# ──────────────────────────────────────────────────────────────────────────────
# Fallback: single-speaker diarization (when libraries/tokens are missing)
# ──────────────────────────────────────────────────────────────────────────────

def _estimate_audio_duration(audio_path: str) -> float:
    """Rough audio duration estimate using pydub (seconds)."""
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(audio_path)
        return len(audio) / 1000.0
    except Exception:
        # If we can't measure, assume a default 60s segment
        return 60.0


def _fallback_single_speaker_diarization(audio_path: str) -> DiarizationResult:
    """
    Graceful fallback: treat the entire audio as a single speaker.
    Used when Pyannote / WhisperX are unavailable or the auth token is missing.
    """
    duration = _estimate_audio_duration(audio_path)
    segment = SpeakerSegment(
        speaker_id="SPEAKER_00",
        speaker_label="Speaker 1",
        start_time=0.0,
        end_time=round(duration, 3),
    )
    result = DiarizationResult(
        segments=[segment],
        unique_speakers=["Speaker 1"],
        speaker_count=1,
    )
    logger.info("Using fallback single-speaker diarization (duration %.1fs)", duration)
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def diarize_audio(
    audio_path: str,
    method: str = "auto",
    num_speakers: Optional[int] = None,
) -> DiarizationResult:
    """
    Run speaker diarization on an audio file.

    Args:
        audio_path: Path to the audio file.
        method: One of ["auto", "pyannote", "whisperx", "fallback"].
                "auto" tries Pyannote first, then WhisperX, then fallback.
        num_speakers: Optional hint for number of speakers.

    Returns:
        DiarizationResult with speaker segments, labels, and counts.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    logger.info("Starting diarization (method=%s)...", method)

    if method == "pyannote":
        return run_pyannote_diarization(audio_path, num_speakers=num_speakers)
    elif method == "whisperx":
        return run_whisperx_diarization(audio_path)
    elif method == "fallback":
        return _fallback_single_speaker_diarization(audio_path)
    else:  # auto
        result = run_pyannote_diarization(audio_path, num_speakers=num_speakers)
        if result.speaker_count <= 1:
            # Pyannote couldn't detect multiple speakers, try WhisperX
            alt_result = run_whisperx_diarization(audio_path)
            if alt_result.speaker_count > result.speaker_count:
                return alt_result
        return result
