import os
from dotenv import load_dotenv
load_dotenv()
import tempfile
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database.connection import init_db, get_db, SessionLocal
from database.seed import seed_clubs
from services.user_service import register_user, login_user, get_user_by_token, update_user_profile

from services.transcript_service import (
    process_and_transcribe,
    process_audio_full_pipeline,
)
from graph.workflow import run_workflow
from services.history_service import save_meeting, get_all_meetings, get_meeting_by_id, update_meeting, get_stats
from rag.document_processor import create_meeting_documents
from rag.vector_store import add_documents_to_store, get_collection_count
from rag.rag_chain import answer_question
from rag.memory import get_chat_history, format_chat_history_for_prompt, add_user_message, add_assistant_message

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MeetMind AI API")

# Allow CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory chat store per session/user
chat_session_state = {"chat_messages": []}

@app.on_event("startup")
def on_startup():
    """Initialize database tables and seed clubs on application start."""
    init_db()
    db = SessionLocal()
    try:
        seed_clubs(db)
    finally:
        db.close()
    logger.info("Database initialized and clubs seeded.")

class ChatRequest(BaseModel):
    question: str
    club_name: Optional[str] = None
    clear_history: bool = False

class UserUpdateRequest(BaseModel):
    club: Optional[str] = None
    name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    studentId: str
    email: str
    password: str
    club: str
    year: str
    department: str

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    user = get_user_by_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return user


@app.get("/")
def read_root():
    return {"status": "AI Service is running"}


def _build_summary(mom_data: Optional[dict]) -> str:
    """Extract a short summary for the meeting_summary JSON field."""
    if not mom_data:
        return ""
    return (
        mom_data.get("summary")
        or mom_data.get("executive_summary")
        or ""
    )


def _normalise_action_items_for_output(items: List[dict]) -> List[dict]:
    """
    Normalise action items to the exact schema requested in the spec:
      { "person": "...", "task": "...", "status": "Assigned|Accepted|..." }
    while keeping all the original richer fields so legacy code still works.
    """
    out = []
    for it in items or []:
        if not isinstance(it, dict):
            continue
        # The spec says "person"; internally we call it "owner" now (formerly assignee).
        person = it.get("owner") or it.get("assignee") or it.get("person") or "TBD"
        task = it.get("task") or ""
        status = it.get("status") or "Assigned"
        # Ensure status is one of the four canonical values
        if status not in {"Assigned", "Accepted", "Pending", "TBD"}:
            status = "Assigned"
        enriched = dict(it)
        enriched["person"] = person
        enriched["task"] = task
        enriched["status"] = status
        # Keep priority, deadline, notes, etc. for richer display
        out.append(enriched)
    return out


@app.post("/api/process-audio")
async def process_audio(
    file: UploadFile = File(...),
    club_name: str = Form(...),
    meeting_date: str = Form(...),
    title: Optional[str] = Form(default=None),
    meeting_type: Optional[str] = Form(default=None),
    num_speakers: Optional[int] = Form(default=None),
    diarization_method: str = Form(default="auto"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Process uploaded audio:
      1. Transcribe (preferring WhisperX w/ word timestamps)
      2. Diarize speakers (Pyannote → WhisperX → fallback)
      3. Detect names from introductions
      4. Reconstruct speaker-labelled transcript
      5. Run LangGraph workflow (meeting analysis → validated action items → MoM)
      6. Persist to history + RAG vector store

    Returns structured JSON per the project spec:
      { meeting_summary, participants, action_items: [{person, task, status}] }
    alongside the existing mom / mom_data / analysis fields for backward compat.
    """
    temp_path: Optional[str] = None
    try:
        # ── 1. Save uploaded file temporarily ──────────────────────────────
        temp_dir = tempfile.gettempdir()
        safe_stem = os.path.basename(file.filename or f"upload_{abs(hash((club_name, meeting_date)))}.wav")
        temp_path = os.path.join(temp_dir, safe_stem)
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        meeting_name = f"{club_name}_{meeting_date.replace(' ', '_')}"

        # ── 2. Speaker-aware transcription pipeline ────────────────────────
        logger.info("Starting speaker-aware pipeline for %s", safe_stem)
        pipeline_result = await run_in_threadpool(
            process_audio_full_pipeline,
            audio_file_path=temp_path,
            save_transcript=True,
            meeting_name=meeting_name,
            diarization_method=diarization_method,
            num_speakers_hint=num_speakers,
        )
        plain_text = pipeline_result.get("plain_text", "")
        labelled_text = pipeline_result.get("labelled_text", "")
        segments = pipeline_result.get("segments", [])
        participants = pipeline_result.get("participants", [])
        speaker_mapping = pipeline_result.get("speaker_mapping", {})

        # Cleanup temp audio asap (don't leave it around on error)
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                temp_path = None
            except Exception:
                pass

        if not plain_text:
            raise HTTPException(status_code=400, detail="Transcription resulted in empty text.")

        # ── 3. Run LangGraph workflow ──────────────────────────────────────
        logger.info("Running LangGraph workflow (participants=%d)...", len(participants))
        final_state = await run_in_threadpool(
            run_workflow,
            transcript=plain_text,
            labelled_transcript=labelled_text,
            transcript_segments=segments,
            participants=participants,
            speaker_mapping=speaker_mapping,
            club_name=club_name,
            meeting_date=meeting_date,
        )
        # Inject user-supplied title / meeting_type into mom_data so the UI
        # displays the exact title the user typed, not a generated fallback
        if isinstance(final_state.get("mom_data"), dict) and title:
            final_state["mom_data"]["title"] = title
        if isinstance(final_state.get("mom_data"), dict) and meeting_type:
            final_state["mom_data"]["meeting_type"] = meeting_type

        if final_state.get("error_message"):
            raise HTTPException(status_code=500, detail=final_state["error_message"])

        # ── 4. Build final outputs ─────────────────────────────────────────
        action_items_raw = final_state.get("extracted_action_items", [])
        action_items = _normalise_action_items_for_output(action_items_raw)
        mom_md = final_state.get("mom", "")
        mom_data = final_state.get("mom_data") or {}

        # Ensure mom_data also carries participants/speaker_mapping/segments
        if not mom_data.get("participants") and participants:
            mom_data["participants"] = list(participants)
        if not mom_data.get("speaker_mapping") and speaker_mapping:
            mom_data["speaker_mapping"] = dict(speaker_mapping)
        if not mom_data.get("transcript_segments") and segments:
            mom_data["transcript_segments"] = list(segments)

        # ── 5. Persist ─────────────────────────────────────────────────────
        # History service
        entry_id = await run_in_threadpool(
            save_meeting,
            db=db,
            club_name=club_name,
            meeting_date=meeting_date,
            transcript_preview=plain_text[:500],
            mom_markdown=mom_md,
            mom_data=mom_data,
            action_items=action_items,
            workflow_log=[],  # not streaming log
            participants=participants,
            speaker_mapping=speaker_mapping,
            labelled_transcript=labelled_text,
            transcript_segments=segments,
            created_by=current_user.get("email", "")
        )

        # ChromaDB
        try:
            docs = await run_in_threadpool(
                create_meeting_documents,
                transcript=plain_text,
                mom_text=mom_md,
                club_name=club_name,
                meeting_date=meeting_date,
                meeting_title=mom_data.get("meeting_title") if mom_data else None,
                decisions=mom_data.get("decisions") if mom_data else None,
            )
            await run_in_threadpool(add_documents_to_store, docs)
        except Exception as e:
            logger.warning("ChromaDB add failed, continuing without RAG ingest: %s", e)

        # ── 6. Structured response per the spec ────────────────────────────
        meeting_summary = _build_summary(mom_data)
        participants_list = list(
            dict.fromkeys(
                mom_data.get("participants") or participants or mom_data.get("attendees") or []
            )
        )

        response_body: Dict[str, Any] = {
            "success": True,
            "id": entry_id,
            # Spec-required structured output
            "meeting_summary": meeting_summary,
            "participants": participants_list,
            "action_items": [
                {
                    "person": ai.get("person", ai.get("owner", ai.get("assignee", "TBD"))),
                    "task": ai.get("task", ""),
                    "status": ai.get("status", "Assigned"),
                    # Additional rich fields (not breaking the spec contract)
                    "deadline": ai.get("deadline"),
                    "priority": ai.get("priority"),
                    "notes": ai.get("notes"),
                    "evidence": ai.get("evidence"),
                    "source_speaker": ai.get("source_speaker"),
                    "owner": ai.get("owner"),
                }
                for ai in action_items
            ],
            # Existing fields (backward compat)
            "mom": mom_md,
            "mom_data": mom_data,
            "analysis": final_state.get("analysis", ""),
            # New debug / rich display fields
            "speaker_mapping": dict(speaker_mapping or {}),
            "transcript_segments": list(segments or []),
            "labelled_transcript": labelled_text,
            "plain_transcript": plain_text,
        }
        return response_body

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error processing audio: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.post("/api/chat")
def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Answer questions using RAG and memory."""
    if request.clear_history:
        chat_session_state["chat_messages"] = []
        return {"success": True, "message": "History cleared"}

    if get_collection_count() == 0:
        return {"answer": "The knowledge base is empty. Generate some meeting minutes first!"}

    add_user_message(chat_session_state, request.question)
    chat_history_str = format_chat_history_for_prompt(chat_session_state)

    try:
        # Restrict RAG queries to user's authorized clubs
        user_clubs = [c.get("club_name") for c in current_user.get("clubs", [])]
        filter_club = request.club_name if request.club_name in user_clubs else (user_clubs[0] if user_clubs else None)
        
        result = answer_question(
            question=request.question,
            filter_club=filter_club,
            chat_history=chat_history_str,
            top_k=5
        )
        
        add_assistant_message(chat_session_state, result["answer"])
        return {
            "answer": result["answer"],
            # Return sources if needed, excluding full docs for simplicity
            "sources": len(result.get("source_docs", []))
        }
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/meetings/history")
async def fetch_history(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch all meetings history"""
    return get_all_meetings(db, current_user)

@app.get("/api/meetings/{meeting_id}")
async def fetch_meeting(meeting_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch a specific meeting by ID"""
    meeting = get_meeting_by_id(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    # Check authorization
    global_role = current_user.get("global_role", "Student")
    if global_role == "Admin":
        return meeting
        
    user_clubs = [c.get("club_name") for c in current_user.get("clubs", [])]
    is_creator = meeting.get("created_by") == current_user.get("email")
    is_participant = current_user.get("name") in (meeting.get("participants") or [])
    is_club_member = meeting.get("club_name") in user_clubs
    
    if not (is_creator or is_participant or is_club_member):
        raise HTTPException(status_code=403, detail="Not authorized to view this meeting")
        
    return meeting

class MeetingUpdateRequest(BaseModel):
    title: Optional[str] = None
    approved: Optional[bool] = None
    action_items: Optional[List[Dict[str, Any]]] = None
    
@app.put("/api/meetings/{meeting_id}")
async def update_meeting_endpoint(meeting_id: str, request: MeetingUpdateRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update a meeting (e.g. title, approval status, action items)"""
    # Authorization check: must be creator, club coordinator, or admin
    meeting = get_meeting_by_id(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    global_role = current_user.get("global_role", "Student")
    is_creator = meeting.get("created_by") == current_user.get("email")
    is_coordinator = any(
        c.get("club_name") == meeting.get("club_name") and c.get("role") == "Coordinator"
        for c in current_user.get("clubs", [])
    )
    
    if global_role != "Admin" and not is_creator and not is_coordinator:
        raise HTTPException(status_code=403, detail="Not authorized to update this meeting")
    
    updates = {}
    if request.title is not None:
        updates["mom_data"] = {"title": request.title}
    if request.approved is not None:
        updates["approved"] = request.approved
    if request.action_items is not None:
        updates["action_items"] = request.action_items
        
    if not updates:
        return {"success": True, "message": "No updates provided"}
        
    updated = update_meeting(db, meeting_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    return {"success": True, "meeting": updated}


@app.put("/api/user")
async def update_user(request: UserUpdateRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update user profile"""
    updates = {}
    if request.club is not None:
        updates["clubs"] = [{
            "club_name": request.club,
            "role": "Member",
            "status": "Active",
        }]
    if request.name is not None:
        updates["name"] = request.name
        
    updated_user = update_user_profile(db, current_user["email"], updates)
    if not updated_user:
        raise HTTPException(status_code=400, detail="User not found")
        
    return {
        "success": True, 
        "user": updated_user
    }

@app.post("/api/auth/register")
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        result = register_user(db, request.dict())
        return {
            "success": True,
            "token": result["token"],
            "user": result["user"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login an existing user"""
    result = login_user(db, request.email, request.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    return {
        "success": True,
        "token": result["token"],
        "user": result["user"]
    }

@app.get("/api/clubs")
async def get_clubs(db: Session = Depends(get_db)):
    """Return clubs from database"""
    stats = get_stats(db)
    return stats.get("clubs", [])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=False)
