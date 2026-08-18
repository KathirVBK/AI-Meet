"""
Speech-to-text service.
Supports multiple transcription backends:
  1. Groq Whisper API (fast, cloud-based, text only)
  2. WhisperX (local, open-source, with word-level timestamps + optional speaker assignment)
  3. Faster-Whisper (local, open-source, text-only fallback)

The default backend is configurable via the STT_BACKEND env var ("groq", "whisperx", "auto").
When using WhisperX, word timestamps and segment-level timing are returned so that
the diarization + reconstruction pipeline can align text to speakers accurately.
"""
import os
import logging
from typing import List, Dict, Any, Optional, TypedDict
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Patch torch.load to bypass weights_only=True errors in PyTorch 2.6+ with pyannote
import torch
_original_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _patched_load

# ──────────────────────────────────────────────────────────────────────────────
# Typed result structures
# ──────────────────────────────────────────────────────────────────────────────

class WordTimestamp(TypedDict, total=False):
    word: str
    start: float
    end: float
    probability: float


class SegmentTimestamp(TypedDict, total=False):
    start: float
    end: float
    text: str
    words: List[WordTimestamp]


class TranscriptionResult(TypedDict, total=False):
    """
    Unified transcription output format.
    Backends populate whichever fields they can.
    """
    text: str
    segments: List[SegmentTimestamp]
    words: List[WordTimestamp]
    language: str
    backend_used: str
    diarization_segments: Optional[List[Dict[str, Any]]]  # WhisperX can run diarization inline


# ──────────────────────────────────────────────────────────────────────────────
# Backend selection helper
# ──────────────────────────────────────────────────────────────────────────────

def _get_backend(preferred: Optional[str] = None) -> str:
    env_backend = os.getenv("STT_BACKEND", "groq").lower()
    backend = (preferred or env_backend).lower()
    return backend


# ──────────────────────────────────────────────────────────────────────────────
# Groq Whisper API backend
# ──────────────────────────────────────────────────────────────────────────────

def get_groq_client() -> Groq:
    """Initialize and return Groq client."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY is not set. Please add your Groq API key to the .env file."
        )
    return Groq(api_key=api_key)


def _transcribe_with_groq(file_path: str, language: str = "en",
                          include_word_timestamps: bool = False) -> TranscriptionResult:
    """
    Transcribe via Groq Whisper API.
    NOTE: Groq currently only returns text, no word timestamps.
    """
    client = get_groq_client()
    model = os.getenv("WHISPER_MODEL", "whisper-large-v3")
    logger.info("Transcribing (Groq Whisper %s): %s", model, file_path)
    try:
        with open(file_path, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model=model,
                file=audio_file,
                language=language,
                response_format="text",
            )
        text = response if isinstance(response, str) else response.text
        logger.info("Groq transcription done. Length: %d chars", len(text))
        return TranscriptionResult(
            text=text,
            segments=[],
            words=[],
            language=language,
            backend_used="groq",
            diarization_segments=None,
        )
    except Exception as e:
        logger.error("Groq transcription failed for %s: %s", file_path, e)
        raise RuntimeError(f"Groq transcription failed: {e}")


# ──────────────────────────────────────────────────────────────────────────────
# WhisperX backend (open-source, local, word timestamps + diarization capable)
# ──────────────────────────────────────────────────────────────────────────────

def _get_hf_token() -> Optional[str]:
    return (os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
            or os.getenv("HUGGING_FACE_HUB_TOKEN") or os.getenv("PYANNOTE_AUTH_TOKEN"))


def _transcribe_with_whisperx(
    file_path: str,
    language: str = "en",
    model_name: str = "large-v2",
    compute_type: str = "float16",
    run_diarization_inline: bool = False,
) -> TranscriptionResult:
    """
    Run WhisperX locally: transcription + forced alignment → word-level timestamps.

    Optionally also runs WhisperX's diarization pipeline inline so that word-level
    speaker labels are produced directly (this skips the need for a separate
    pyannote call, but both are valid flows).
    """
    try:
        import whisperx
        import torch
    except ImportError:
        raise RuntimeError("WhisperX is not installed. Please install it via requirements.txt.")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    # CPU cannot realistically run float16
    if device == "cpu":
        compute_type = "int8" if compute_type in ("float16", "float32") else compute_type

    logger.info("WhisperX init — device=%s, compute=%s, model=%s", device, compute_type, model_name)

    # Stage 1: Transcribe
    logger.info("WhisperX Stage 1 — loading ASR model...")
    model = whisperx.load_model(model_name, device, compute_type=compute_type, language=language)
    audio = whisperx.load_audio(file_path)
    result = model.transcribe(audio, batch_size=16 if device == "cuda" else 4)
    detected_lang = result.get("language", language)
    logger.info("WhisperX Stage 1 done — %d segments, lang=%s",
                len(result.get("segments", [])), detected_lang)

    # Stage 2: Force-align to get word timestamps
    logger.info("WhisperX Stage 2 — aligning...")
    align_model, metadata = whisperx.load_align_model(language_code=detected_lang, device=device)
    result = whisperx.align(
        result["segments"], align_model, metadata, audio, device,
        return_char_alignments=False,
    )

    segments: List[SegmentTimestamp] = [
        SegmentTimestamp(
            start=float(seg.get("start", 0.0)),
            end=float(seg.get("end", 0.0)),
            text=seg.get("text", ""),
            words=[WordTimestamp(
                word=w.get("word", ""),
                start=float(w.get("start", 0.0)),
                end=float(w.get("end", 0.0)),
                probability=float(w.get("score", w.get("probability", 0.0))),
            ) for w in seg.get("words", [])],
        ) for seg in result.get("segments", [])
    ]

    # Flatten word list
    all_words: List[WordTimestamp] = []
    for seg in segments:
        all_words.extend(seg["words"])

    full_text = "\n".join(s["text"].strip() for s in segments if s["text"].strip())

    # Optional Stage 3: Diarize inline + reassign word speakers
    diarization_segments: Optional[List[Dict[str, Any]]] = None
    if run_diarization_inline:
        hf_token = _get_hf_token()
        if hf_token:
            logger.info("WhisperX Stage 3 — inline diarization...")
            try:
                diarize_model = whisperx.DiarizationPipeline(
                    use_auth_token=hf_token, device=device,
                )
                diarize_segments_df = diarize_model(file_path)
                result = whisperx.assign_word_speakers(diarize_segments_df, result)

                # Build speaker segments for the diarization module format
                import pandas as pd
                if isinstance(diarize_segments_df, pd.DataFrame):
                    rows = diarize_segments_df.to_dict("records")
                    label_map: Dict[str, str] = {}
                    counter = 0
                    for row in rows:
                        spk = row.get("speaker", "SPEAKER_00")
                        if spk not in label_map:
                            counter += 1
                            label_map[spk] = f"Speaker {counter}"

                    diarization_segments = [
                        {
                            "speaker_id": row.get("speaker", "SPEAKER_00"),
                            "speaker_label": label_map.get(row.get("speaker", "SPEAKER_00"), "Speaker 1"),
                            "start_time": float(row.get("start", 0.0)),
                            "end_time": float(row.get("end", 0.0)),
                            "text": "",
                        } for row in rows
                    ]
                    logger.info("WhisperX inline diarization produced %d speaker segments",
                                len(diarization_segments))
            except Exception as e:
                logger.warning("WhisperX inline diarization skipped: %s", e)
        else:
            logger.warning("Skipping WhisperX inline diarization — no HF token set.")

    # Free GPU memory where possible
    del model
    try:
        del align_model
    except Exception:
        pass
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return TranscriptionResult(
        text=full_text,
        segments=segments,
        words=all_words,
        language=detected_lang,
        backend_used="whisperx",
        diarization_segments=diarization_segments,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Faster-Whisper fallback (open-source local, no word timestamps but no HF deps)
# ──────────────────────────────────────────────────────────────────────────────

def _transcribe_with_faster_whisper(
    file_path: str,
    language: str = "en",
    model_size: str = "large-v3",
) -> TranscriptionResult:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise RuntimeError("faster-whisper is not installed.")

    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute = "float16" if device == "cuda" else "int8"
    logger.info("Faster-Whisper init — device=%s, compute=%s, model=%s", device, compute, model_size)

    model = WhisperModel(model_size, device=device, compute_type=compute)
    segments, info = model.transcribe(file_path, language=language, beam_size=5)
    detected_lang = info.language if info else language

    out_segments: List[SegmentTimestamp] = []
    text_parts: List[str] = []
    for seg in segments:
        out_segments.append(SegmentTimestamp(
            start=float(seg.start), end=float(seg.end), text=seg.text, words=[],
        ))
        text_parts.append(seg.text.strip())

    return TranscriptionResult(
        text="\n".join(t for t in text_parts if t),
        segments=out_segments,
        words=[],
        language=detected_lang,
        backend_used="faster_whisper",
        diarization_segments=None,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Public dispatchers
# ──────────────────────────────────────────────────────────────────────────────

def transcribe_audio_file_detailed(
    file_path: str,
    language: str = "en",
    preferred_backend: Optional[str] = None,
    include_word_timestamps: bool = True,
) -> TranscriptionResult:
    """
    Transcribe a single audio file and return a detailed TranscriptionResult.

    - "whisperx": local, open-source, word timestamps, optionally diarization.
    - "groq": cloud Whisper API, fastest, text-only.
    - "faster_whisper": local, open-source, text + segment timestamps.
    - "auto": tries whisperx (if timestamps requested) → groq → faster_whisper.
    """
    backend = _get_backend(preferred_backend)

    if backend == "auto":
        # Pick intelligently based on request
        if include_word_timestamps:
            backend_errors: Dict[str, str] = {}
            for candidate in ("groq", "whisperx", "faster_whisper"):
                try:
                    if candidate == "whisperx":
                        return _transcribe_with_whisperx(file_path, language)
                    elif candidate == "faster_whisper":
                        return _transcribe_with_faster_whisper(file_path, language)
                    else:
                        return _transcribe_with_groq(file_path, language)
                except Exception as e:
                    logger.exception("Backend %s failed; trying next...", candidate)
                    backend_errors[candidate] = str(e)
            raise RuntimeError(f"All transcription backends failed. Backend errors: {backend_errors}")
        else:
            # No timestamps needed — prefer Groq for speed
            backend_errors: Dict[str, str] = {}
            for candidate in ("groq", "faster_whisper", "whisperx"):
                try:
                    if candidate == "groq":
                        return _transcribe_with_groq(file_path, language)
                    elif candidate == "faster_whisper":
                        return _transcribe_with_faster_whisper(file_path, language)
                    else:
                        return _transcribe_with_whisperx(file_path, language)
                except Exception as e:
                    logger.exception("Backend %s failed; trying next...", candidate)
                    backend_errors[candidate] = str(e)
            raise RuntimeError(f"All transcription backends failed. Backend errors: {backend_errors}")

    if backend == "groq":
        return _transcribe_with_groq(file_path, language)
    if backend == "whisperx":
        return _transcribe_with_whisperx(file_path, language)
    if backend in ("faster-whisper", "faster_whisper"):
        return _transcribe_with_faster_whisper(file_path, language)

    logger.warning("Unknown backend %s, falling back to auto.", backend)
    return transcribe_audio_file_detailed(file_path, language, "auto", include_word_timestamps)


def transcribe_audio_file(file_path: str, language: str = "en") -> str:
    """
    Simplified backward-compatible API: returns just the transcript text.
    """
    result = transcribe_audio_file_detailed(file_path, language, include_word_timestamps=False)
    return result.get("text", "")


def transcribe_audio_chunks(chunk_paths: List[str], language: str = "en") -> str:
    """
    Backward-compatible chunk transcription. Returns concatenated text.
    NOTE: When using a backend that supports word-level timestamps, you should
    prefer transcribe_audio_file_detailed() on the combined file instead.
    """
    if not chunk_paths:
        raise ValueError("No audio chunks provided for transcription.")

    all_transcripts = []
    total = len(chunk_paths)

    for i, chunk_path in enumerate(chunk_paths):
        logger.info("Transcribing chunk %d/%d: %s", i + 1, total, chunk_path)
        transcript = transcribe_audio_file(chunk_path, language)
        all_transcripts.append(transcript)

    full_transcript = " ".join(all_transcripts)
    logger.info("All chunks transcribed. Total length: %d chars", len(full_transcript))
    return full_transcript


def transcribe_audio_chunks_detailed(chunk_paths: List[str], language: str = "en") -> TranscriptionResult:
    """Detailed (timestamped) transcription of multiple chunks, merged carefully."""
    if not chunk_paths:
        raise ValueError("No audio chunks provided for transcription.")

    merged_text_parts: List[str] = []
    merged_segments: List[SegmentTimestamp] = []
    merged_words: List[WordTimestamp] = []
    backend_used = "unknown"
    lang_used = language
    time_offset = 0.0

    for chunk_path in chunk_paths:
        result = transcribe_audio_file_detailed(chunk_path, language, include_word_timestamps=True)
        backend_used = result.get("backend_used", backend_used)
        lang_used = result.get("language", lang_used)
        merged_text_parts.append(result.get("text", ""))

        for seg in result.get("segments", []):
            offset_seg = SegmentTimestamp(
                start=seg.get("start", 0.0) + time_offset,
                end=seg.get("end", 0.0) + time_offset,
                text=seg.get("text", ""),
                words=[WordTimestamp(
                    word=w.get("word", ""),
                    start=w.get("start", 0.0) + time_offset,
                    end=w.get("end", 0.0) + time_offset,
                    probability=w.get("probability", 0.0),
                ) for w in seg.get("words", [])],
            )
            merged_segments.append(offset_seg)
            merged_words.extend(offset_seg["words"])

        # Bump offset by last segment end (or a safe 10 min guess)
        if merged_segments:
            time_offset = merged_segments[-1]["end"] + 0.5
        else:
            time_offset += 10 * 60.0

    return TranscriptionResult(
        text="\n".join(t for t in merged_text_parts if t),
        segments=merged_segments,
        words=merged_words,
        language=lang_used,
        backend_used=backend_used,
        diarization_segments=None,
    )
