import os
import shutil
import tempfile
from pathlib import Path

from services.audio_processor import split_audio_into_chunks


def test_split_audio_into_chunks_for_long_audio(tmp_path):
    from pydub import AudioSegment

    audio = AudioSegment.silent(duration=20 * 60 * 1000)
    audio_path = tmp_path / "long.wav"
    audio.export(audio_path, format="wav")

    chunk_paths = split_audio_into_chunks(str(audio_path), str(tmp_path))

    assert len(chunk_paths) == 2
    assert all(Path(p).exists() for p in chunk_paths)
    for path in chunk_paths:
        os.remove(path)
