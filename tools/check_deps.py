import importlib

mods = ['whisperx', 'faster_whisper', 'torch', 'pyannote.audio', 'chromadb']

for m in mods:
    try:
        mod = importlib.import_module(m)
        v = getattr(mod, '__version__', None)
        print(f'{m}: installed, version={v}')
    except Exception as e:
        print(f'{m}: NOT INSTALLED or import error: {e}')
