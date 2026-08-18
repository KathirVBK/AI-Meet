# 🧠 MeetMind — Automatic Meeting Minutes & Action Item Generator

> AI-powered meeting intelligence for student clubs — powered by **LangGraph**, **Groq**, **ChromaDB**, and **Streamlit**.

---

## ✨ Features

- 🎙️ **Audio Transcription** — Upload meeting recordings (WAV, MP3, M4A, OGG). Groq Whisper STT converts them to text automatically.
- 🤖 **5-Node LangGraph Agent Workflow** — A stateful pipeline that analyzes, extracts, validates, and re-analyzes action items before generating the final MoM.
- 📋 **Structured Action Items** — Automatically extracts tasks with assignee, deadline, and priority labels.
- ✅ **Quality Validation Loop** — AI validates its own output and retries (up to 3x) if issues are found.
- 📄 **PDF Export** — Download professional-quality Minutes of Meeting PDFs.
- 💾 **Knowledge Base** — All meeting minutes are stored in ChromaDB using Hugging Face embeddings for future retrieval.
- 💬 **Club Q&A (RAG)** — Ask natural language questions about any previous meeting.

---

## 🗂️ Project Structure

```
automatic-meeting-minutes/
├── app.py                    # Streamlit UI
├── graph/
│   ├── state.py              # LangGraph TypedDict state
│   ├── router.py             # Conditional routing logic
│   └── workflow.py           # Graph compilation + streaming
├── agents/
│   ├── meeting_analyzer.py   # Node 1: Transcript analysis
│   ├── action_extractor.py   # Node 2: Action item extraction
│   ├── validator.py          # Node 3: Quality validation
│   ├── reanalyzer.py         # Node 4: Error correction
│   └── mom_generator.py      # Node 5: MoM compilation
├── services/
│   ├── audio_processor.py    # FFmpeg-based audio conversion + splitting
│   ├── speech_to_text.py     # Groq Whisper integration
│   ├── transcript_service.py # End-to-end transcription pipeline
│   └── pdf_service.py        # ReportLab PDF generation
├── rag/
│   ├── embeddings.py         # HuggingFace all-MiniLM-L6-v2
│   ├── vector_store.py       # ChromaDB management
│   ├── document_processor.py # Text chunking with metadata
│   ├── retriever.py          # Similarity search
│   └── rag_chain.py          # RAG Q&A chain (Groq LLM)
├── models/
│   └── schemas.py            # Pydantic models
├── prompts/                  # All LLM prompt templates
├── utils/
│   ├── transcript_cleaner.py # Filler-word removal + normalization
│   └── file_utils.py         # File management helpers
├── data/
│   ├── audio/                # Temporary uploaded audio files
│   └── transcripts/          # Saved transcript text files
├── chroma_db/                # ChromaDB persistent vector store
├── output/                   # Generated PDF files
├── .env                      # API keys (not committed)
└── requirements.txt
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- [FFmpeg](https://ffmpeg.org/download.html) installed and added to PATH

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure API key

Edit `.env` and add your Groq API key:
```
GROQ_API_KEY=your_groq_api_key_here
```

Get your free Groq API key at: [console.groq.com](https://console.groq.com)

### 4. Run the app

```bash
streamlit run app.py
```

---

## 🤖 Agent Workflow (LangGraph)

```
START
  │
  ▼
Meeting Analyzer ──────► Extracts structure, attendees, agenda, decisions
  │
  ▼
Action Extractor ──────► Identifies tasks, owners, deadlines, priorities
  │
  ▼
Validator ─────────────► Quality checks (vague tasks, missing assignees, etc.)
  │
  ├── [Errors & attempts < 3] ──► Reanalyzer ──► back to Validator
  │
  └── [Valid OR max attempts] ──► MoM Generator ──► END
```

---

## 🛠️ Tech Stack

| Component         | Technology                        |
|-------------------|-----------------------------------|
| UI                | Streamlit                         |
| Agent Orchestration | LangGraph                       |
| LLM               | Groq (llama-3.3-70b-versatile)    |
| Speech-to-Text    | Groq Whisper Large v3             |
| Audio Processing  | pydub + FFmpeg                    |
| Embeddings        | HuggingFace all-MiniLM-L6-v2      |
| Vector Database   | ChromaDB                          |
| PDF Generation    | ReportLab                         |
| Data Validation   | Pydantic v2                       |
| Environment       | python-dotenv                     |

---

## 📝 License
MIT License
