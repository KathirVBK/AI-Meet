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
from database.models import Club
from services.user_service import register_user, login_user, get_user_by_token, update_user_profile, get_all_users, update_user_role, update_user_status, add_user_to_club, remove_user_from_club, get_user_by_email
from services.admin_service import log_audit_action, get_all_audit_logs, get_system_settings, update_system_setting
from services.rbac_service import (
    seed_rbac, has_permission, get_all_roles, get_all_permissions, 
    assign_permission_to_role, remove_permission_from_role,
    can_access_meeting, is_coordinator_for_club_by_id, is_coordinator_for_club_by_name,
    is_member_or_coordinator_for_club
)
from services.club_service import (
    get_all_clubs_admin, create_club, update_club, update_club_status, get_club_details,
)

from services.transcript_service import (
    process_and_transcribe,
    process_audio_full_pipeline,
)
from graph.workflow import run_workflow
from services.history_service import (
    save_meeting, get_all_meetings, get_meeting_by_id, update_meeting, get_stats, delete_meeting,
    get_pending_meetings, update_meeting_approval, get_club_action_items, nudge_action_item, get_monthly_club_report
)
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

# ── Database initialisation on every startup ─────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """Ensure all database tables exist, RBAC is seeded, and default accounts exist."""
    from database.connection import init_db
    init_db()  # Create tables if they don't exist
    # Seed RBAC roles and permissions, clubs, and default users
    db = SessionLocal()
    try:
        from services.rbac_service import seed_rbac
        from database.seed import seed_all
        seed_rbac(db)
        seed_all(db)
    except Exception as e:
        logger.warning(f"Startup seed warning: {e}")
    finally:
        db.close()


# In-memory chat store per session/user
chat_session_state = {"chat_messages": []}


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
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Your account has been suspended")
    return user




def require_permission(permission_name: str):
    """Centralized RBAC authorization dependency factory."""
    def permission_checker(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
        user_role = current_user.get("global_role")
        if not user_role:
            raise HTTPException(status_code=403, detail="User has no role assigned")
            
        if not has_permission(db, user_role, permission_name):
            raise HTTPException(status_code=403, detail=f"Missing required permission: {permission_name}")
            
        return current_user
    return permission_checker


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
    language: str = Form(default="auto"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Process uploaded audio:
      1. Transcribe (preferring WhisperX w/ word timestamps)
      2. Diarize speakers (Pyannote → WhisperX → fallback)
      3. Detect names from introductions
      4. Reconstruct speaker-labelled transcript
      5. Run LangGraph workflow with club persona & agenda template
      6. Persist to history with approval workflow + RAG vector store
    """
    temp_path: Optional[str] = None
    try:
        # ── 0. Strict Club Authorization Check ─────────────────────────────
        club_clean = (club_name or "").strip()
        if not club_clean:
            raise HTTPException(status_code=400, detail="Club name is required.")
            
        if not is_member_or_coordinator_for_club(db, current_user, club_clean):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You are not a member or coordinator of '{club_clean}'. You can only generate meeting MOMs for clubs you belong to."
            )

        # ── 1. Save uploaded file temporarily ──────────────────────────────
        temp_dir = tempfile.gettempdir()
        safe_stem = os.path.basename(file.filename or f"upload_{abs(hash((club_clean, meeting_date)))}.wav")
        temp_path = os.path.join(temp_dir, safe_stem)
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        meeting_name = f"{club_clean}_{meeting_date.replace(' ', '_')}"

        # ── 2. Speaker-aware transcription pipeline ────────────────────────
        logger.info("Starting speaker-aware pipeline for %s", safe_stem)
        pipeline_result = await run_in_threadpool(
            process_audio_full_pipeline,
            audio_file_path=temp_path,
            language=language,
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

        # ── 4. Run LangGraph workflow ──────────────────────────────────────
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

        # Non-fatal workflow errors: if we have action items already extracted
        # (e.g. reanalyzer failed) don't abort — just log and continue.
        if final_state.get("error_message"):
            action_items_available = bool(final_state.get("extracted_action_items"))
            if not action_items_available:
                raise HTTPException(status_code=500, detail=final_state["error_message"])
            logger.warning("Workflow reported a non-fatal error (continuing with partial output): %s",
                           final_state["error_message"])

        # ── 5. Build final outputs ─────────────────────────────────────────
        action_items_raw = final_state.get("extracted_action_items", [])
        action_items = _normalise_action_items_for_output(action_items_raw)
        mom_md = final_state.get("mom", "")
        mom_data = final_state.get("mom_data") or {}

        # ── Sync action_items back into mom_data so the stored JSON and the
        #    action_items DB table always match each other. ─────────────────
        if isinstance(mom_data, dict):
            mom_data["action_items"] = action_items

        # Ensure mom_data also carries participants/speaker_mapping/segments
        if not mom_data.get("participants") and participants:
            mom_data["participants"] = list(participants)
        if not mom_data.get("speaker_mapping") and speaker_mapping:
            mom_data["speaker_mapping"] = dict(speaker_mapping)
        if not mom_data.get("transcript_segments") and segments:
            mom_data["transcript_segments"] = list(segments)

        # Determine initial approval status
        approval_status = "APPROVED"
        user_role = current_user.get("global_role")
        if user_role != "SUPER_ADMIN" and not is_coordinator_for_club_by_name(db, current_user, club_name):
            approval_status = "PENDING_REVIEW"

        # ── 6. Persist ─────────────────────────────────────────────────────
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
            created_by=current_user.get("id", ""),
            approval_status=approval_status,
        )

        # ChromaDB — indexed after meeting is persisted so meeting_id is available
        try:
            docs = await run_in_threadpool(
                create_meeting_documents,
                transcript=plain_text,
                mom_text=mom_md,
                club_name=club_name,
                meeting_date=meeting_date,
                meeting_title=mom_data.get("meeting_title") if mom_data else None,
                decisions=mom_data.get("decisions") if mom_data else None,
                meeting_id=entry_id,
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
        
        # Log the sequence of actions that occurred during processing
        user_id = current_user.get("id")
        user_email = current_user.get("email")
        if user_id:
            log_audit_action(db, user_id, user_email, "AUDIO_UPLOADED", {
                "target_entity": "Meeting",
                "target_id": entry_id,
                "new_value": file.filename
            })
            log_audit_action(db, user_id, user_email, "TRANSCRIPTION_CREATED", {
                "target_entity": "Meeting",
                "target_id": entry_id
            })
            log_audit_action(db, user_id, user_email, "ACTION_PLAN_GENERATED", {
                "target_entity": "Meeting",
                "target_id": entry_id,
                "new_value": f"{len(action_items)} action items"
            })
            log_audit_action(db, user_id, user_email, "MEETING_CREATED", {
                "target_entity": "Meeting",
                "target_id": entry_id,
                "new_value": title or "Meeting"
            })
            
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


@app.post("/api/meetings/process")
async def process_meeting_upload(
    audio: Optional[UploadFile] = File(default=None),
    file: Optional[UploadFile] = File(default=None),
    club_name: str = Form(...),
    meeting_date: str = Form(...),
    title: Optional[str] = Form(default=None),
    meeting_type: Optional[str] = Form(default=None),
    num_speakers: Optional[int] = Form(default=None),
    diarization_method: str = Form(default="auto"),
    language: str = Form(default="auto"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Direct alias endpoint for /api/meetings/process accepting either 'audio' or 'file'."""
    upload_file = audio or file
    if not upload_file:
        raise HTTPException(status_code=400, detail="No audio file uploaded. Expected 'audio' or 'file' form field.")
    return await process_audio(
        file=upload_file,
        club_name=club_name,
        meeting_date=meeting_date,
        title=title,
        meeting_type=meeting_type,
        num_speakers=num_speakers,
        diarization_method=diarization_method,
        language=language,
        current_user=current_user,
        db=db
    )


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
    if not can_access_meeting(db, current_user, meeting):
        raise HTTPException(status_code=403, detail="Access denied")
        
    return meeting

class MeetingUpdateRequest(BaseModel):
    title: Optional[str] = None
    approved: Optional[bool] = None
    action_items: Optional[List[Dict[str, Any]]] = None
    
@app.put("/api/meetings/{meeting_id}")
async def update_meeting_endpoint(meeting_id: str, request: MeetingUpdateRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update a meeting (e.g. title, approval status, action items)"""
    # Authorization check: Use can_access_meeting
    meeting = get_meeting_by_id(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if not can_access_meeting(db, current_user, meeting):
        raise HTTPException(status_code=403, detail="Access denied")
    
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


@app.get("/api/user")
async def get_current_user_profile(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the profile of the currently authenticated user including active clubs."""
    user = get_user_by_email(db, current_user["email"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "user": user}


@app.get("/api/user/clubs")
async def get_current_user_clubs(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return only the clubs the currently authenticated user belongs to (or all active clubs if SUPER_ADMIN)."""
    user_id = current_user.get("id")
    global_role = current_user.get("global_role")
    
    if global_role == "SUPER_ADMIN":
        clubs = db.query(Club).filter(Club.is_active == True).all()
        return {
            "success": True,
            "clubs": [{"id": c.id, "name": c.name, "role": "Super Admin"} for c in clubs]
        }
        
    from database.models import ClubMember
    memberships = db.query(ClubMember).join(Club).filter(
        ClubMember.user_id == user_id,
        ClubMember.status == "Active",
        Club.is_active == True
    ).all()
    
    result = [{
        "id": m.club.id,
        "name": m.club.name,
        "role": m.role
    } for m in memberships if m.club]
    
    return {"success": True, "clubs": result}

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
    try:
        result = login_user(db, request.email, request.password)
        if not result:
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        return {
            "success": True,
            "token": result["token"],
            "user": result["user"]
        }
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.get("/api/clubs")
async def get_clubs(db: Session = Depends(get_db)):
    """Return clubs from database"""
    stats = get_stats(db)
    return stats.get("clubs", [])


# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

class UserRoleUpdateRequest(BaseModel):
    global_role: str

class UserStatusUpdateRequest(BaseModel):
    is_active: bool

class SettingUpdateRequest(BaseModel):
    value: dict
    description: Optional[str] = None

class UserClubAssignmentRequest(BaseModel):
    club_name: str
    role: str = "Member"

class ClubCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None

class ClubUpdateRequest(BaseModel):
    name: str
    description: Optional[str] = None

class ClubStatusUpdateRequest(BaseModel):
    is_active: bool

class RolePermissionRequest(BaseModel):
    permission_name: str

class MeetingApprovalRequest(BaseModel):
    status: str  # "APPROVED" | "REJECTED"
    notes: Optional[str] = None

class ClubPersonaRequest(BaseModel):
    ai_persona: Optional[str] = None
    require_approval: Optional[bool] = None

class AgendaTemplateCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    agenda_items: List[str] = []

@app.get("/api/admin/stats")
async def get_admin_stats(db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.dashboard.view"))):
    """Return system-wide or scoped statistics for the admin dashboard"""
    is_super_admin = admin.get("global_role") == "SUPER_ADMIN"
    
    # 1. Scope Clubs
    all_clubs = get_all_clubs_admin(db)
    if is_super_admin:
        visible_clubs = all_clubs
    else:
        visible_clubs = [c for c in all_clubs if is_coordinator_for_club_by_id(db, admin, c["id"])]
        
    visible_club_names = [c["name"] for c in visible_clubs]
    visible_club_ids = [c["id"] for c in visible_clubs]
    
    # 2. Scope Users
    users = get_all_users(db)
    if is_super_admin:
        visible_users = users
    else:
        # A user is visible if they are a member of any of the admin's visible_clubs
        from database.models import ClubMember
        member_user_ids = [
            m.user_id for m in db.query(ClubMember).filter(ClubMember.club_id.in_(visible_club_ids)).all()
        ]
        visible_users = [u for u in users if u["id"] in member_user_ids]
    
    active_users = sum(1 for u in visible_users if u.get("is_active", True))
    inactive_users = len(visible_users) - active_users
    
    recent_users = list(reversed(visible_users))[:5]
    
    # 3. Scope Meetings
    visible_meetings = get_all_meetings(db, admin)
    total_action_items = sum(m.get("action_item_count", 0) for m in visible_meetings)
    recent_meetings = visible_meetings[:5]
    
    # 4. Scope Activities
    recent_activities = get_all_audit_logs(db, limit=100)
    if not is_super_admin:
        # Filter audit logs... we can just hide them for ADMIN, or show only logs where user_email is in visible_users.
        # But wait, step 5 says ADMIN should NOT view global audit logs.
        recent_activities = []
    else:
        recent_activities = recent_activities[:5]

    return {
        "success": True,
        "total_meetings": len(visible_meetings),
        "total_action_items": total_action_items,
        "total_users": len(visible_users),
        "active_users": active_users,
        "inactive_users": inactive_users,
        "total_clubs": len(visible_clubs),
        "recent_users": recent_users,
        "recent_meetings": recent_meetings,
        "recent_activities": recent_activities,
    }

@app.get("/api/admin/users")
async def fetch_all_users(db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.users.manage"))):
    """Return all users in the system"""
    users = get_all_users(db)
    return {"success": True, "users": users}

@app.get("/api/admin/users/{user_id}")
async def get_user_details(user_id: str, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.users.manage"))):
    """Fetch deep user details for the admin modal"""
    users = get_all_users(db)
    user = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Get user activity (meetings and audit logs)
    all_meetings = get_all_meetings(db, admin)
    created_meetings = [m for m in all_meetings if m.get("created_by") == user.get("email")]
    
    all_logs = get_all_audit_logs(db, limit=1000)
    system_activity = [log for log in all_logs if log.get("user_email") == user.get("email")]
    
    return {
        "success": True,
        "user": user,
        "meetings": created_meetings,
        "activity": system_activity
    }

@app.post("/api/admin/users/{user_id}/clubs")
async def assign_club_endpoint(user_id: str, request: UserClubAssignmentRequest, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.users.manage"))):
    try:
        updated = add_user_to_club(db, user_id, request.club_name, request.role)
        log_audit_action(db, admin.get("id"), admin.get("email"), "MEMBER_ADDED", {
            "target_entity": "User",
            "target_id": user_id,
            "new_value": request.club_name
        })
        return {"success": True, "user": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/admin/users/{user_id}/clubs/{club_name}")
async def remove_club_endpoint(user_id: str, club_name: str, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.users.manage"))):
    try:
        updated = remove_user_from_club(db, user_id, club_name)
        log_audit_action(db, admin.get("id"), admin.get("email"), "MEMBER_REMOVED", {
            "target_entity": "User",
            "target_id": user_id,
            "previous_value": club_name
        })
        return {"success": True, "user": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/admin/users/{user_id}/role")
async def update_user_role_endpoint(user_id: str, request: UserRoleUpdateRequest, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.roles.manage"))):
    """Update a user's role"""
    if admin.get("id") == user_id:
        raise HTTPException(status_code=403, detail="You cannot change your own role")
        
    if request.global_role not in ["STUDENT", "ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    updated = update_user_role(db, user_id, request.global_role)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
        
    log_audit_action(db, admin.get("id"), admin.get("email"), "ROLE_CHANGED", {
        "target_entity": "User",
        "target_id": user_id,
        "new_value": request.global_role
    })
    return {"success": True, "user": updated}

@app.put("/api/admin/users/{user_id}/status")
async def update_user_status_endpoint(user_id: str, request: UserStatusUpdateRequest, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.users.manage"))):
    """Suspend or activate a user"""
    if admin.get("id") == user_id and not request.is_active:
        raise HTTPException(status_code=403, detail="You cannot suspend your own account")
        
    updated = update_user_status(db, user_id, request.is_active)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
        
    action_name = "ACCOUNT_ACTIVATED" if request.is_active else "ACCOUNT_SUSPENDED"
    log_audit_action(db, admin.get("id"), admin.get("email"), action_name, {
        "target_entity": "User",
        "target_id": user_id
    })
    return {"success": True, "user": updated}


@app.get("/api/admin/meetings")
async def fetch_all_meetings_admin(db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.meetings.manage"))):
    """Return all meetings without any filtering"""
    meetings = get_all_meetings(db, admin)
    return {"success": True, "meetings": meetings}

@app.delete("/api/admin/meetings/{meeting_id}")
async def delete_meeting_admin(meeting_id: str, db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.meetings.manage"))):
    meeting = get_meeting_by_id(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    if not can_access_meeting(db, admin, meeting):
        raise HTTPException(status_code=403, detail="You can only delete meetings for clubs where you are a Coordinator")

    success = delete_meeting(db, meeting_id)
        
    log_audit_action(db, admin.get("id"), admin.get("email"), "MEETING_DELETED", {
        "target_entity": "Meeting",
        "target_id": meeting_id
    })
    return {"success": True, "message": "Meeting deleted successfully"}

@app.get("/api/admin/pending-meetings")
async def get_pending_meetings_endpoint(db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.meetings.manage"))):
    """Return meetings awaiting approval, scoped to the admin's clubs"""
    meetings = get_pending_meetings(db, admin)
    return {"success": True, "meetings": meetings}

@app.put("/api/admin/meetings/{meeting_id}/approval")
async def update_meeting_approval_endpoint(meeting_id: str, request: MeetingApprovalRequest, db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.meetings.manage"))):
    """Approve or reject a meeting with optional feedback notes"""
    if request.status not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Status must be APPROVED or REJECTED")
    updated = update_meeting_approval(db, meeting_id, request.status, request.notes, admin.get("id"))
    if not updated:
        raise HTTPException(status_code=404, detail="Meeting not found")
    log_audit_action(db, admin.get("id"), admin.get("email"), f"MEETING_{request.status}", {
        "target_entity": "Meeting",
        "target_id": meeting_id,
        "notes": request.notes
    })
    return {"success": True, "meeting": updated}

@app.get("/api/admin/club-action-items")
async def get_club_action_items_endpoint(club_id: Optional[str] = None, db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.meetings.manage"))):
    """Fetch all action items across clubs managed by the admin with overdue status"""
    items = get_club_action_items(db, admin, club_id=club_id)
    return {"success": True, "action_items": items}

@app.post("/api/admin/action-items/{action_item_id}/nudge")
async def nudge_action_item_endpoint(action_item_id: str, db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.meetings.manage"))):
    """Increment nudge count and record audit log for an action item reminder"""
    res = nudge_action_item(db, action_item_id)
    if not res:
        raise HTTPException(status_code=404, detail="Action item not found")
    log_audit_action(db, admin.get("id"), admin.get("email"), "NUDGE_SENT", {
        "target_entity": "ActionItem",
        "target_id": action_item_id,
        "owner": res.get("owner"),
        "nudge_count": res.get("nudge_count")
    })
    return {"success": True, "action_item": res}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN CLUB ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/admin/clubs")
async def fetch_all_clubs_admin(db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.dashboard.view"))):
    clubs = get_all_clubs_admin(db)
    if admin.get("global_role") == "ADMIN":
        clubs = [c for c in clubs if is_coordinator_for_club_by_id(db, admin, c["id"])]
    return {"success": True, "clubs": clubs}

@app.post("/api/admin/clubs")
async def create_club_endpoint(request: ClubCreateRequest, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.clubs.manage_global"))):
    try:
        club = create_club(db, request.name, request.description)
        log_audit_action(db, admin.get("id"), admin.get("email"), "CLUB_CREATED", {
            "target_entity": "Club",
            "target_id": club["id"],
            "new_value": request.name
        })
        return {"success": True, "club": club}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/admin/clubs/{club_id}")
async def update_club_endpoint(club_id: str, request: ClubUpdateRequest, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.clubs.manage_global"))):
    club = update_club(db, club_id, request.name, request.description)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    log_audit_action(db, admin.get("id"), admin.get("email"), "CLUB_UPDATED", {
        "target_entity": "Club",
        "target_id": club_id,
        "new_value": request.name
    })
    return {"success": True, "club": club}

@app.put("/api/admin/clubs/{club_id}/status")
async def update_club_status_endpoint(club_id: str, request: ClubStatusUpdateRequest, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.clubs.manage_global"))):
    club = update_club_status(db, club_id, request.is_active)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    log_audit_action(db, admin.get("id"), admin.get("email"), "CLUB_UPDATED", {
        "target_entity": "Club",
        "target_id": club_id,
        "new_value": request.is_active
    })
    return {"success": True, "club": club}

@app.get("/api/admin/clubs/{club_id}")
async def fetch_club_details_endpoint(club_id: str, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.dashboard.view"))):
    if admin.get("global_role") == "ADMIN":
        if not is_coordinator_for_club_by_id(db, admin, club_id):
            raise HTTPException(status_code=403, detail="You can only view details for clubs where you are a Coordinator")
            
    details = get_club_details(db, club_id)
    if not details:
        raise HTTPException(status_code=404, detail="Club not found")
    return {"success": True, "club": details}

@app.get("/api/admin/clubs/{club_id}/members")
async def fetch_club_members(club_id: str, db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.members.manage"))):
    if admin.get("global_role") == "ADMIN":
        if not is_coordinator_for_club_by_id(db, admin, club_id):
            raise HTTPException(status_code=403, detail="You can only manage members for clubs where you are a Coordinator")
    details = get_club_details(db, club_id)
    if not details:
        raise HTTPException(status_code=404, detail="Club not found")
    return {"success": True, "members": details.get("roster", [])}

@app.post("/api/admin/clubs/{club_id}/members")
async def add_member_by_email(club_id: str, request: dict, db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.members.manage"))):
    email = request.get("email")
    role = request.get("role", "Member")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if role not in ["Member", "Coordinator"]:
        raise HTTPException(status_code=400, detail="Invalid club role. Must be 'Member' or 'Coordinator'.")
    
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found with that email")
        
    details = get_club_details(db, club_id)
    if not details:
        raise HTTPException(status_code=404, detail="Club not found")
        
    if admin.get("global_role") == "ADMIN":
        if not is_coordinator_for_club_by_id(db, admin, club_id):
            raise HTTPException(status_code=403, detail="You can only manage members for clubs where you are a Coordinator")
        
    add_user_to_club(db, user.get("id"), club_id, role)
    log_audit_action(db, admin.get("id"), admin.get("email"), "MEMBER_ADDED", {
        "target_entity": "Club",
        "target_id": club_id,
        "new_value": email
    })
    return {"success": True}

@app.put("/api/admin/clubs/{club_id}/members/{user_id}")
async def update_club_member(club_id: str, user_id: str, request: dict, db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.members.manage"))):
    if admin.get("global_role") == "ADMIN":
        if not is_coordinator_for_club_by_id(db, admin, club_id):
            raise HTTPException(status_code=403, detail="You can only manage members for clubs where you are a Coordinator")
    
    role = request.get("role")
    if role not in ["Member", "Coordinator"]:
        raise HTTPException(status_code=400, detail="Invalid club role. Must be 'Member' or 'Coordinator'.")
        
    from services.club_service import update_club_member_role
    success = update_club_member_role(db, club_id, user_id, role)
    if not success:
        raise HTTPException(status_code=404, detail="Club member not found")
        
    log_audit_action(db, admin.get("id"), admin.get("email"), "MEMBER_ROLE_UPDATED", {
        "target_entity": "Club",
        "target_id": club_id,
        "user_id": user_id,
        "new_value": role
    })
    return {"success": True}

@app.delete("/api/admin/clubs/{club_id}/members/{user_id}")
async def remove_club_member(club_id: str, user_id: str, db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.members.manage"))):
    if admin.get("global_role") == "ADMIN":
        if not is_coordinator_for_club_by_id(db, admin, club_id):
            raise HTTPException(status_code=403, detail="You can only manage members for clubs where you are a Coordinator")
        
    from services.club_service import remove_user_from_club_by_id
    success = remove_user_from_club_by_id(db, club_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Club member not found")
        
    log_audit_action(db, admin.get("id"), admin.get("email"), "MEMBER_REMOVED", {
        "target_entity": "Club",
        "target_id": club_id,
        "user_id": user_id
    })
    return {"success": True}
@app.get("/api/admin/clubs/{club_id}/analytics")
async def fetch_club_analytics(club_id: str, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.dashboard.view"))):
    if admin.get("global_role") == "ADMIN":
        if not is_coordinator_for_club_by_id(db, admin, club_id):
            raise HTTPException(status_code=403, detail="You can only view analytics for clubs where you are a Coordinator")
            
    details = get_club_details(db, club_id)
    if not details:
        raise HTTPException(status_code=404, detail="Club not found")
        
    all_meetings = get_all_meetings(db, admin)
    club_meetings = [m for m in all_meetings if m.get("club_name") == details.get("name")]
    
    total_action_items = sum(m.get("action_item_count", 0) for m in club_meetings)
    member_count = len(details.get("roster", []))
    
    return {
        "success": True,
        "analytics": {
            "meeting_count": len(club_meetings),
            "member_count": member_count,
            "action_items": total_action_items
        }
    }


# ── Monthly Club Activity Reports ──
@app.get("/api/admin/clubs/{club_id}/monthly-report")
async def get_monthly_report_endpoint(club_id: str, month: int, year: int, db: Session = Depends(get_db), admin: dict = Depends(require_permission("clubs.meetings.manage"))):
    if admin.get("global_role") == "ADMIN":
        if not is_coordinator_for_club_by_id(db, admin, club_id):
            raise HTTPException(status_code=403, detail="You can only generate reports for clubs where you are a Coordinator")
    try:
        report = get_monthly_club_report(db, club_id, month=month, year=year)
        return {"success": True, "report": report}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/admin/logs")
async def fetch_audit_logs(db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.audit_logs.view"))):
    """Return audit logs"""
    logs = get_all_audit_logs(db, limit=200)
    return {"success": True, "logs": logs}

@app.get("/api/admin/settings")
async def fetch_system_settings(db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.settings.manage"))):
    """Return all system settings"""
    settings = get_system_settings(db)
    return {"success": True, "settings": settings}

@app.put("/api/admin/settings/{key}")
async def update_system_setting_endpoint(key: str, request: SettingUpdateRequest, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.settings.manage"))):
    """Update a system setting"""
    setting = update_system_setting(db, key, request.value, request.description)
    log_audit_action(db, admin.get("id"), admin.get("email"), "UPDATED_SYSTEM_SETTING", {"key": key, "value": request.value})
    return {"success": True, "setting": setting}

# ═══════════════════════════════════════════════════════════════════════════════
# RBAC MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/admin/roles")
async def fetch_roles_endpoint(db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.roles.manage"))):
    roles = get_all_roles(db)
    return {"success": True, "roles": roles}

@app.get("/api/admin/permissions")
async def fetch_permissions_endpoint(db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.roles.manage"))):
    perms = get_all_permissions(db)
    return {"success": True, "permissions": perms}

@app.post("/api/admin/roles/{role_name}/permissions")
async def assign_role_permission(role_name: str, request: RolePermissionRequest, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.roles.manage"))):
    assign_permission_to_role(db, role_name, request.permission_name)
    log_audit_action(db, admin.get("id"), admin.get("email"), "PERMISSION_CHANGED", {
        "target_entity": "Role",
        "target_id": role_name,
        "new_value": f"+ {request.permission_name}"
    })
    return {"success": True}

@app.delete("/api/admin/roles/{role_name}/permissions/{permission_name}")
async def revoke_role_permission(role_name: str, permission_name: str, db: Session = Depends(get_db), admin: dict = Depends(require_permission("admin.roles.manage"))):
    remove_permission_from_role(db, role_name, permission_name)
    log_audit_action(db, admin.get("id"), admin.get("email"), "PERMISSION_CHANGED", {
        "target_entity": "Role",
        "target_id": role_name,
        "new_value": f"- {permission_name}"
    })
    return {"success": True}

@app.get("/api/clubs/{club_name}/agenda-templates")
async def get_agenda_templates(club_name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return {"success": True, "templates": []}


@app.get("/api/meetings/{meeting_id}/export-pdf")
async def export_meeting_pdf(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Generate and stream a PDF for a given meeting.
    Auth-protected: user must have access to the meeting.
    Routing: User → React → API server (auth) → PDF generation → streamed response.
    """
    from fastapi.responses import StreamingResponse
    import io

    # 1. Load meeting from DB (enforces existence check)
    meeting = get_meeting_by_id(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # 2. RBAC: user must belong to the club or be an admin
    user_role = current_user.get("global_role", "")
    user_clubs = [c.get("club_name") for c in current_user.get("clubs", [])]
    club_name = meeting.get("club_name", "")
    if user_role not in ("SUPER_ADMIN", "ADMIN") and club_name not in user_clubs:
        raise HTTPException(status_code=403, detail="Access denied to this meeting")

    # 3. Build PDF with ReportLab
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
            title=meeting.get("title") or "Minutes of Meeting",
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=18, textColor=colors.HexColor("#1e3a5f"), spaceAfter=6)
        h2_style    = ParagraphStyle("H2",    parent=styles["Heading2"], fontSize=12, textColor=colors.HexColor("#2563eb"), spaceBefore=12, spaceAfter=4)
        body_style  = ParagraphStyle("Body",  parent=styles["Normal"], fontSize=10, leading=14)
        small_style = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9, textColor=colors.grey)

        mom_data = meeting.get("mom_data") or {}
        action_items = meeting.get("action_items") or mom_data.get("action_items") or []
        decisions    = meeting.get("decisions") or mom_data.get("decisions") or []
        participants = meeting.get("participants") or mom_data.get("attendees") or []

        story = []

        # Header
        story.append(Paragraph(mom_data.get("meeting_title") or meeting.get("title") or "Minutes of Meeting", title_style))
        story.append(Paragraph(f"{mom_data.get('club_name') or club_name}", small_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2563eb"), spaceAfter=8))

        # Meta table
        meta = [
            ["Date", meeting.get("meeting_date") or mom_data.get("date") or "N/A"],
            ["Venue", mom_data.get("venue") or "N/A"],
            ["Prepared By", "AI Meeting Assistant (MeetMind)"],
            ["Approval Status", meeting.get("approval_status") or "APPROVED"],
        ]
        meta_table = Table(meta, colWidths=[4*cm, 13*cm])
        meta_table.setStyle(TableStyle([
            ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 9),
            ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#eff6ff")),
            ("TEXTCOLOR", (0,0), (0,-1), colors.HexColor("#1e3a5f")),
            ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0,0), (-1,-1), 4),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.4*cm))

        # Attendees
        if participants:
            story.append(Paragraph("Attendees", h2_style))
            for p in participants:
                story.append(Paragraph(f"• {p}", body_style))
            story.append(Spacer(1, 0.3*cm))

        # Summary
        summary = mom_data.get("executive_summary") or mom_data.get("summary") or meeting.get("summary") or ""
        if summary:
            story.append(Paragraph("Executive Summary", h2_style))
            story.append(Paragraph(summary, body_style))
            story.append(Spacer(1, 0.3*cm))

        # Decisions
        if decisions:
            story.append(Paragraph("Decisions Made", h2_style))
            for d in decisions:
                text = d.get("decision", str(d)) if isinstance(d, dict) else str(d)
                status = d.get("status", "") if isinstance(d, dict) else ""
                story.append(Paragraph(f"• {text}" + (f" <i>({status})</i>" if status else ""), body_style))
            story.append(Spacer(1, 0.3*cm))

        # Action Items table
        if action_items:
            story.append(Paragraph("Action Items", h2_style))
            ai_data = [["#", "Task", "Owner", "Deadline", "Priority", "Status"]]
            for idx, ai in enumerate(action_items, 1):
                ai_data.append([
                    str(idx),
                    ai.get("task") or ai.get("task", ""),
                    ai.get("owner") or ai.get("person") or "TBD",
                    ai.get("deadline") or "N/A",
                    ai.get("priority") or "Medium",
                    ai.get("status") or "Assigned",
                ])
            ai_table = Table(ai_data, colWidths=[0.8*cm, 6*cm, 3*cm, 2.5*cm, 2*cm, 2.5*cm])
            ai_table.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2563eb")),
                ("TEXTCOLOR", (0,0), (-1,0), colors.white),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("FONTSIZE", (0,0), (-1,-1), 8),
                ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f0f9ff")]),
                ("GRID", (0,0), (-1,-1), 0.4, colors.HexColor("#cbd5e1")),
                ("PADDING", (0,0), (-1,-1), 4),
                ("VALIGN", (0,0), (-1,-1), "TOP"),
            ]))
            story.append(ai_table)
            story.append(Spacer(1, 0.3*cm))

        doc.build(story)
        buf.seek(0)

        safe_title = (meeting.get("title") or "meeting").replace(" ", "_")[:40]
        filename = f"minutes_{safe_title}_{meeting_id[:6]}.pdf"
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library not available. Install reportlab.")
    except Exception as e:
        logger.error("PDF export failed for meeting %s: %s", meeting_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api_server:app", host="0.0.0.0", port=port, reload=False)
