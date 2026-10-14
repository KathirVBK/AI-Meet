#!/usr/bin/env bash
# Exit on any error
set -o errexit

echo "==> Upgrading pip..."
pip install --upgrade pip

echo "==> Installing lightweight CPU-only PyTorch..."
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

echo "==> Installing remaining dependencies..."
pip install -r requirements.txt

echo "==> Build completed successfully!"
