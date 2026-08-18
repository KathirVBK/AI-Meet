"""
File utilities for managing audio, transcript, and output directories.
"""
import os
import shutil
from pathlib import Path
from datetime import datetime


def ensure_directories():
    """Create all required project directories if they don't exist."""
    dirs = [
        "./data/audio",
        "./data/transcripts",
        "./output",
        "./chroma_db",
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)


def save_uploaded_file(uploaded_file, save_dir: str = "./data/audio") -> str:
    """
    Save a Streamlit uploaded file object to disk.

    Args:
        uploaded_file: Streamlit UploadedFile object.
        save_dir: Directory to save the file.

    Returns:
        Absolute path to the saved file.
    """
    os.makedirs(save_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{uploaded_file.name}"
    file_path = os.path.join(save_dir, filename)

    with open(file_path, "wb") as f:
        f.write(uploaded_file.getbuffer())

    return file_path


def get_output_files(output_dir: str = "./output") -> list:
    """Return list of files in the output directory."""
    if not os.path.exists(output_dir):
        return []
    return sorted(Path(output_dir).glob("*.pdf"), key=os.path.getmtime, reverse=True)


def cleanup_audio_dir(audio_dir: str = "./data/audio"):
    """Remove all files from the audio directory."""
    if os.path.exists(audio_dir):
        for f in Path(audio_dir).glob("*"):
            if f.is_file():
                f.unlink()
