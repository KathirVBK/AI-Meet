"""
Audio processing service.
Handles audio format conversion, size checking and chunking using pydub + FFmpeg.
"""
import os
import math
import logging
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)

# Groq Whisper API max file size in bytes (25 MB)
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
# Default chunk duration: split long recordings so backends don't choke on very long files.
# Keep this conservative (8 minutes) to avoid edge cases from model/API limits.
AUDIO_CHUNK_DURATION_MINUTES = int(os.getenv("AUDIO_CHUNK_DURATION_MINUTES", "8"))
CHUNK_DURATION_MS = AUDIO_CHUNK_DURATION_MINUTES * 60 * 1000


def get_file_size_mb(file_path: str) -> float:
    """Return file size in megabytes."""
    return os.path.getsize(file_path) / (1024 * 1024)


def convert_audio_to_wav(input_path: str, output_dir: str) -> str:
    """
    Convert audio file to WAV format using pydub (requires FFmpeg).
    Returns path to the converted WAV file.
    """
    try:
        from pydub import AudioSegment

        input_path = Path(input_path)
        output_path = Path(output_dir) / f"{input_path.stem}.wav"

        logger.info(f"Converting {input_path.name} to WAV format...")
        audio = AudioSegment.from_file(str(input_path))
        # Convert to mono, 16kHz for best Whisper performance
        audio = audio.set_channels(1).set_frame_rate(16000)
        audio.export(str(output_path), format="wav")
        logger.info(f"Converted audio saved to: {output_path}")
        return str(output_path)
    except Exception as e:
        logger.error(f"Audio conversion failed: {e}")
        raise RuntimeError(f"Audio conversion failed: {e}")


def get_audio_duration_ms(audio_path: str) -> int:
    """Return the audio duration in milliseconds."""
    from pydub import AudioSegment

    audio = AudioSegment.from_file(audio_path)
    return len(audio)


def split_audio_into_chunks(audio_path: str, output_dir: str) -> List[str]:
    """
    Split large audio file into smaller chunks for transcription.
    Returns list of file paths to the chunks.
    """
    try:
        from pydub import AudioSegment

        audio = AudioSegment.from_file(audio_path)
        total_duration_ms = len(audio)
        num_chunks = max(1, math.ceil(total_duration_ms / CHUNK_DURATION_MS))

        chunk_paths = []
        output_dir = Path(output_dir)
        base_name = Path(audio_path).stem

        logger.info(f"Splitting audio into {num_chunks} chunks...")

        for i in range(num_chunks):
            start_ms = i * CHUNK_DURATION_MS
            end_ms = min((i + 1) * CHUNK_DURATION_MS, total_duration_ms)
            chunk = audio[start_ms:end_ms]

            chunk_path = output_dir / f"{base_name}_chunk_{i+1}.mp3"
            chunk.export(str(chunk_path), format="mp3", bitrate="64k")
            chunk_paths.append(str(chunk_path))
            logger.info(f"  Chunk {i+1}/{num_chunks} saved: {chunk_path.name}")

        return chunk_paths
    except Exception as e:
        logger.error(f"Audio splitting failed: {e}")
        raise RuntimeError(f"Audio splitting failed: {e}")


def prepare_audio_for_transcription(input_path: str, temp_dir: str = "./data/audio") -> List[str]:
    """
    Main entry point: Convert and split audio if necessary.
    Returns list of audio file paths ready for transcription.
    """
    os.makedirs(temp_dir, exist_ok=True)
    file_size_mb = get_file_size_mb(input_path)
    logger.info(f"Audio file size: {file_size_mb:.2f} MB")

    # Force conversion to ensure 16kHz mono and clean headers, even if it's already a .wav
    audio_path = convert_audio_to_wav(input_path, temp_dir)

    # Check if splitting is needed by size or by duration.
    file_size = os.path.getsize(audio_path)
    try:
        duration_ms = get_audio_duration_ms(audio_path)
        should_split = file_size > MAX_FILE_SIZE_BYTES or duration_ms > CHUNK_DURATION_MS
    except Exception as e:
        logger.warning("Could not estimate audio duration for chunking: %s", e)
        should_split = file_size > MAX_FILE_SIZE_BYTES

    if should_split:
        logger.info(
            "File exceeds size/duration limits (%s MB, %s min), splitting into chunks...",
            f"{file_size_mb:.2f}",
            round(duration_ms / 60000, 1) if 'duration_ms' in locals() else 'unknown',
        )
        return split_audio_into_chunks(audio_path, temp_dir)
    else:
        logger.info("File within size and duration limits, no splitting required.")
        return [audio_path]


def cleanup_temp_files(file_paths: List[str]) -> None:
    """Remove temporary audio chunk files after transcription."""
    for path in file_paths:
        try:
            if os.path.exists(path) and "_chunk_" in path:
                os.remove(path)
                logger.info(f"Cleaned up temp file: {path}")
        except Exception as e:
            logger.warning(f"Could not delete temp file {path}: {e}")
