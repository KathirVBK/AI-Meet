"""
Automatic Meeting Minutes and Action Item Generator — Streamlit UI
Premium dark-mode interface with real-time LangGraph node tracking,
Conversation Memory, Knowledge Base management, and Persistent History.
"""
import os
import sys
import json
import logging
from datetime import datetime

import streamlit as st
from dotenv import load_dotenv

# ── Path setup so sub-packages can resolve correctly ────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

# ── Page configuration (MUST be first Streamlit call) ───────────────────────
st.set_page_config(
    page_title="MeetMind — AI Meeting Minutes",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ───────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

/* Global font */
html, body, [class*="css"] {
    font-family: 'Inter', sans-serif;
}

/* Main background */
.stApp {
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
    min-height: 100vh;
}

/* Header banner */
.hero-banner {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #4f46e5 100%);
    border-radius: 20px;
    padding: 2.5rem 2rem;
    margin-bottom: 2rem;
    text-align: center;
    box-shadow: 0 20px 60px rgba(79, 70, 229, 0.4);
    position: relative;
    overflow: hidden;
}
.hero-banner::before {
    content: '';
    position: absolute;
    top: -50%; left: -50%;
    width: 200%; height: 200%;
    background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
    animation: pulse 4s ease-in-out infinite;
}
@keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.05); opacity: 1; }
}
.hero-title {
    font-size: 2.8rem;
    font-weight: 800;
    color: white;
    margin: 0;
    letter-spacing: -0.5px;
    position: relative;
    z-index: 1;
}
.hero-subtitle {
    font-size: 1.1rem;
    color: rgba(255,255,255,0.8);
    margin-top: 0.5rem;
    font-weight: 400;
    position: relative;
    z-index: 1;
}

/* Cards (Glassmorphism) */
.glass-card, .metric-card, .history-card, .kb-card {
    background: rgba(30, 27, 75, 0.6);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    backdrop-filter: blur(10px);
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}
.glass-card:hover, .metric-card:hover, .history-card:hover, .kb-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.8);
}
.metric-card { text-align: center; }
.metric-value { font-size: 2.2rem; font-weight: 700; color: #818cf8; margin: 0; }
.metric-label { font-size: 0.85rem; color: rgba(248, 250, 252, 0.6); margin-top: 0.25rem; text-transform: uppercase; letter-spacing: 0.5px; }

/* History & KB Specific */
.history-title { font-size: 1.2rem; font-weight: 600; color: #e0e7ff; margin-bottom: 0.5rem; }
.history-meta { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1rem; }
.pill-badge {
    display: inline-block;
    background: rgba(99, 102, 241, 0.2);
    color: #a5b4fc;
    border-radius: 9999px;
    padding: 2px 10px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-right: 0.5rem;
}

/* Node status log */
.node-log {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 12px;
    padding: 1rem 1.5rem;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: #94a3b8;
    margin-bottom: 0.5rem;
    position: relative;
    overflow: hidden;
}
.node-log.complete { border-color: rgba(34, 197, 94, 0.4); color: #86efac; }
.node-log.active {
    border-color: rgba(99, 102, 241, 0.6);
    color: #a5b4fc;
}
.node-log.active::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, #818cf8, transparent);
    width: 50%;
    animation: loading-bar 1.5s infinite linear;
}
@keyframes loading-bar {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
}

/* Action items table */
.action-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
.action-table th {
    background: rgba(79, 70, 229, 0.7); color: white;
    padding: 12px 16px; text-align: left; font-size: 0.85rem;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
}
.action-table td {
    padding: 10px 16px; border-bottom: 1px solid rgba(99, 102, 241, 0.15);
    color: #cbd5e1; font-size: 0.9rem; vertical-align: top;
}
.action-table tr:nth-child(even) td { background: rgba(30, 27, 75, 0.3); }
.priority-high   { color: #f87171; font-weight: 600; }
.priority-medium { color: #fbbf24; font-weight: 600; }
.priority-low    { color: #34d399; font-weight: 600; }

/* Section headers */
.section-header {
    font-size: 1.3rem; font-weight: 700; color: #a5b4fc;
    margin: 1.5rem 0 0.75rem; padding-bottom: 0.5rem;
    border-bottom: 2px solid rgba(99, 102, 241, 0.3);
}

/* Sidebar styling */
section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%);
    border-right: 1px solid rgba(99, 102, 241, 0.2);
}
section[data-testid="stSidebar"] .stTextInput input,
section[data-testid="stSidebar"] .stSelectbox select {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #f8fafc;
}

/* Streamlit overrides */
.stTabs [data-baseweb="tab-list"] {
    background: rgba(30, 27, 75, 0.5); border-radius: 12px; padding: 4px; gap: 4px;
}
.stTabs [data-baseweb="tab"] {
    border-radius: 8px; color: #94a3b8; font-weight: 500;
}
.stTabs [aria-selected="true"] {
    background: linear-gradient(135deg, #4f46e5, #7c3aed) !important; color: white !important;
}
.stButton > button {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white; border: none; border-radius: 10px; font-weight: 600;
    padding: 0.6rem 1.5rem; transition: all 0.2s; font-family: 'Inter', sans-serif;
}
.stButton > button:hover {
    transform: translateY(-2px); box-shadow: 0 8px 25px rgba(79, 70, 229, 0.4);
}
.stButton.danger > button {
    background: linear-gradient(135deg, #ef4444, #b91c1c);
}
div[data-testid="stFileUploader"] {
    border: 2px dashed rgba(99, 102, 241, 0.4); border-radius: 16px;
    background: rgba(30, 27, 75, 0.3); transition: border-color 0.2s;
}
div[data-testid="stFileUploader"]:hover { border-color: rgba(99, 102, 241, 0.8); }

/* Chat UI Overrides */
.stChatMessage {
    background-color: transparent !important;
}
.stChatMessage [data-testid="chatAvatarIcon-user"] {
    background-color: #6366f1;
}
.stChatMessage [data-testid="chatAvatarIcon-assistant"] {
    background-color: #10b981;
}
.stChatMessage[data-testid="stChatMessage"] > div:nth-child(2) {
    background: rgba(30, 27, 75, 0.5);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 12px;
    padding: 1rem;
}
</style>
""", unsafe_allow_html=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Helper functions ─────────────────────────────────────────────────────────

def check_api_key() -> bool:
    """Check if GROQ API key is configured."""
    key = os.getenv("GROQ_API_KEY") or st.session_state.get("groq_api_key", "")
    return bool(key and key.strip())


def set_api_key_in_env(key: str):
    """Temporarily set API key in environment for this session."""
    os.environ["GROQ_API_KEY"] = key
    st.session_state["groq_api_key"] = key


def priority_badge(priority: str) -> str:
    cls = f"priority-{priority.lower()}"
    return f'<span class="{cls}">{priority}</span>'


def render_action_items_table(action_items: list):
    """Render a styled HTML action items table."""
    if not action_items:
        st.info("No action items were extracted from this meeting.")
        return

    rows = ""
    for i, item in enumerate(action_items, 1):
        priority = item.get("priority", "Medium")
        p_cls = f"priority-{priority.lower()}"
        notes = item.get("notes") or "—"
        rows += f"""
        <tr>
            <td><b>{i}</b></td>
            <td>{item.get('task', '—')}</td>
            <td>{item.get('assignee', 'TBD')}</td>
            <td>{item.get('deadline', 'N/A')}</td>
            <td><span class="{p_cls}">{priority}</span></td>
            <td>{notes}</td>
        </tr>
        """

    st.markdown(f"""
    <table class="action-table">
        <thead>
            <tr>
                <th>#</th><th>Task</th><th>Assignee</th>
                <th>Deadline</th><th>Priority</th><th>Notes</th>
            </tr>
        </thead>
        <tbody>{rows}</tbody>
    </table>
    """, unsafe_allow_html=True)


# ── Sidebar ──────────────────────────────────────────────────────────────────

# Ensure session state variables for chat history
from rag.memory import get_chat_history, add_user_message, add_assistant_message, format_chat_history_for_prompt, clear_chat_history
if "chat_messages" not in st.session_state:
    clear_chat_history(st.session_state)

with st.sidebar:
    st.markdown("### MeetMind")
    st.markdown("*AI-powered meeting intelligence for student clubs*")
    st.divider()

    st.markdown("#### ⚙️ Configuration")

    # API Key input
    env_key = os.getenv("GROQ_API_KEY", "")
    if env_key:
        st.success("Groq API key loaded from .env")
    else:
        user_key = st.text_input(
            "Groq API Key",
            type="password",
            placeholder="gsk_...",
            help="Enter your Groq API key. Get one at console.groq.com",
            key="groq_key_input",
        )
        if user_key:
            set_api_key_in_env(user_key)
            st.success("API key set for this session")

    st.divider()

    # Club name input
    club_name = st.text_input(
        "🏫 Club Name",
        value=st.session_state.get("club_name", "Tech Innovation Club"),
        placeholder="e.g. Robotics Club, Drama Society...",
        key="club_name_input",
    )
    st.session_state["club_name"] = club_name

    meeting_date = st.date_input(
        "📅 Meeting Date",
        value=datetime.today(),
        key="meeting_date_input",
    )
    meeting_date_str = meeting_date.strftime("%B %d, %Y")

    st.divider()
    
    st.markdown("#### 📊 Dashboard Stats")
    try:
        from rag.vector_store import get_collection_count
        from services.history_service import get_stats
        
        kb_count = get_collection_count()
        hist_stats = get_stats()
        
        col1, col2 = st.columns(2)
        col1.metric("Meetings", hist_stats["total_meetings"])
        col2.metric("Action Items", hist_stats["total_action_items"])
        st.metric("KB Chunks Stored", kb_count)
        
    except Exception:
        st.info("No stats available yet.")

    st.divider()
    st.markdown("**Made with** LangGraph · LangChain · Groq")


# ── Hero Banner ───────────────────────────────────────────────────────────────

st.markdown("""
<div class="hero-banner">
    <p class="hero-title">MeetMind</p>
    <p class="hero-subtitle">Automatic Meeting Minutes & Knowledge Intelligence</p>
</div>
""", unsafe_allow_html=True)


# ── Tabs ──────────────────────────────────────────────────────────────────────

tab1, tab2, tab3, tab4 = st.tabs([
    "New Meeting", 
    "AI Chat", 
    "Knowledge Base",
    "History"
])


# ══════════════════════════════════════════════════════════════════════════════
# TAB 1: NEW MEETING MINUTES
# ══════════════════════════════════════════════════════════════════════════════

with tab1:
    col_left, col_right = st.columns([1.2, 1], gap="large")

    with col_left:
        st.markdown('<p class="section-header">Upload Meeting Audio</p>', unsafe_allow_html=True)

        uploaded_file = st.file_uploader(
            "Drag and drop your meeting recording here",
            type=["wav", "mp3", "m4a", "ogg", "flac", "mp4"],
            help="Supports WAV, MP3, M4A, OGG, FLAC, MP4. Max 200MB.",
            label_visibility="collapsed",
        )

        if uploaded_file:
            st.audio(uploaded_file)
            file_size_mb = len(uploaded_file.getbuffer()) / (1024 * 1024)
            col_a, col_b, col_c = st.columns(3)
            with col_a:
                st.markdown(f'<div class="metric-card"><p class="metric-value">{file_size_mb:.1f}</p><p class="metric-label">MB</p></div>', unsafe_allow_html=True)
            with col_b:
                st.markdown(f'<div class="metric-card"><p class="metric-value">{uploaded_file.type.split("/")[1].upper()}</p><p class="metric-label">Format</p></div>', unsafe_allow_html=True)
            with col_c:
                st.markdown(f'<div class="metric-card"><p class="metric-value">✓</p><p class="metric-label">Ready</p></div>', unsafe_allow_html=True)

        # Also allow direct transcript paste
        st.markdown('<p class="section-header">📝 Or Paste Transcript</p>', unsafe_allow_html=True)
        manual_transcript = st.text_area(
            "Paste meeting transcript directly (optional)",
            placeholder="Paste your meeting transcript here if you already have one...",
            height=180,
            label_visibility="collapsed",
        )

        st.markdown("---")
        generate_btn = st.button("🚀 Generate Meeting Minutes", use_container_width=True, type="primary")

    with col_right:
        st.markdown('<p class="section-header">Agent Workflow Status</p>', unsafe_allow_html=True)

        node_display_names = {
            "meeting_analyzer": "🔍 Meeting Analyzer",
            "action_extractor": "Action Extractor",
            "validator":        "Validator",
            "reanalyzer":       "🔄 Reanalyzer",
            "mom_generator":    "📝 MoM Generator",
        }

        if "workflow_log" not in st.session_state:
            st.session_state.workflow_log = []

        if st.session_state.workflow_log:
            for entry in st.session_state.workflow_log:
                status = entry.get("status", "complete")
                prefix = "✓" if status == "complete" else "⏳"
                st.markdown(
                    f'<div class="node-log {status}">{prefix} {node_display_names.get(entry["node"], entry["node"])}</div>',
                    unsafe_allow_html=True,
                )
                if entry.get("detail"):
                    st.caption(entry["detail"])
        else:
            st.markdown(
                '<div class="node-log">Waiting for audio upload and generate trigger...</div>',
                unsafe_allow_html=True,
            )

    # ── Main generation logic ────────────────────────────────────────────────
    if generate_btn:
        if not check_api_key():
            st.error("🔑 Please add your Groq API key in the sidebar to continue.")
            st.stop()

        transcript_text = ""

        # Priority: uploaded audio > pasted transcript
        if uploaded_file is not None:
            with st.spinner("🎵 Processing audio and transcribing..."):
                try:
                    from utils.file_utils import save_uploaded_file, ensure_directories
                    from services.transcript_service import process_and_transcribe
                    ensure_directories()
                    audio_path = save_uploaded_file(uploaded_file)
                    transcript_text = process_and_transcribe(
                        audio_path,
                        save_transcript=True,
                        meeting_name=f"{club_name}_{meeting_date_str.replace(' ', '_')}",
                    )
                    st.success(f"Transcription complete! ({len(transcript_text)} characters)")
                except Exception as e:
                    st.error(f"❌ Transcription failed: {e}")
                    logger.error(f"Transcription error: {e}")
                    st.stop()

        elif manual_transcript.strip():
            transcript_text = manual_transcript.strip()
            st.info("📝 Using manually entered transcript.")
        else:
            st.warning("Please upload an audio file or paste a transcript to continue.")
            st.stop()

        # Display transcript preview
        with st.expander("View Transcript Preview", expanded=False):
            st.text(transcript_text[:2000] + ("..." if len(transcript_text) > 2000 else ""))

        # ── Run LangGraph workflow with streaming ────────────────────────────
        st.markdown("---")
        st.markdown('<p class="section-header">Running AI Agent Workflow</p>', unsafe_allow_html=True)

        st.session_state.workflow_log = []
        final_state = None

        try:
            from graph.workflow import stream_workflow

            with st.spinner("Running LangGraph agents..."):
                for node_name, state in stream_workflow(
                    transcript=transcript_text,
                    club_name=club_name,
                    meeting_date=meeting_date_str,
                ):
                    final_state = state

                    # Build detail message
                    detail = ""
                    if node_name == "meeting_analyzer":
                        detail = f"Analysis generated ({len(state.get('analysis', ''))} chars)"
                    elif node_name == "action_extractor":
                        n = len(state.get("extracted_action_items", []))
                        detail = f"{n} action item(s) extracted"
                    elif node_name == "validator":
                        errs = len(state.get("validation_errors", []))
                        detail = f"{errs} validation issue(s) found" if errs else "All items valid ✓"
                    elif node_name == "reanalyzer":
                        detail = "Issues corrected, re-validating..."
                    elif node_name == "mom_generator":
                        detail = f"MoM generated ({len(state.get('mom', ''))} chars)"

                    st.session_state.workflow_log.append({
                        "node": node_name, 
                        "detail": detail,
                        "status": "complete"
                    })

            st.success("Workflow completed successfully!")
            
            # ── Auto-save to Knowledge Base and History ─────────────────────
            with st.spinner("💾 Auto-saving to Knowledge Base & History..."):
                try:
                    # Save to History
                    from services.history_service import save_meeting
                    action_items = final_state.get("extracted_action_items", [])
                    mom_md = final_state.get("mom", "")
                    mom_data = final_state.get("mom_data")
                    
                    save_meeting(
                        club_name=club_name,
                        meeting_date=meeting_date_str,
                        transcript_preview=transcript_text[:500],
                        mom_markdown=mom_md,
                        mom_data=mom_data,
                        action_items=action_items,
                        workflow_log=st.session_state.workflow_log,
                    )
                    
                    # Save to KB (ChromaDB)
                    from rag.document_processor import create_meeting_documents
                    from rag.vector_store import add_documents_to_store
                    docs = create_meeting_documents(
                        transcript=transcript_text,
                        mom_text=mom_md,
                        club_name=club_name,
                        meeting_date=meeting_date_str,
                        meeting_title=mom_data.get("title") if mom_data else None,
                    )
                    n = add_documents_to_store(docs)
                    st.success(f"Auto-saved {n} chunks to KB & logged to History!")
                except Exception as e:
                    st.warning(f"⚠️ Workflow succeeded, but auto-save had an issue: {e}")

        except Exception as e:
            st.error(f"❌ Workflow error: {e}")
            logger.error(f"Workflow error: {e}", exc_info=True)
            st.stop()

        # ── Display Results ──────────────────────────────────────────────────
        if final_state:
            st.markdown("---")

            # Metrics row
            action_items = final_state.get("extracted_action_items", [])
            attempts = final_state.get("validation_attempts", 0)
            high_priority = sum(1 for a in action_items if a.get("priority") == "High")

            m1, m2, m3, m4 = st.columns(4)
            with m1:
                st.markdown(f'<div class="metric-card"><p class="metric-value">{len(action_items)}</p><p class="metric-label">Action Items</p></div>', unsafe_allow_html=True)
            with m2:
                st.markdown(f'<div class="metric-card"><p class="metric-value">{high_priority}</p><p class="metric-label">High Priority</p></div>', unsafe_allow_html=True)
            with m3:
                st.markdown(f'<div class="metric-card"><p class="metric-value">{attempts}</p><p class="metric-label">Validation Loops</p></div>', unsafe_allow_html=True)
            with m4:
                mom_len = len(final_state.get("mom", "").split())
                st.markdown(f'<div class="metric-card"><p class="metric-value">{mom_len}</p><p class="metric-label">MoM Words</p></div>', unsafe_allow_html=True)

            st.markdown("---")

            # Results in tabs
            res_tab1, res_tab2, res_tab3 = st.tabs(["Minutes of Meeting", "Action Items", "Raw Analysis"])

            with res_tab1:
                st.markdown(final_state.get("mom", "No MoM generated."))

            with res_tab2:
                render_action_items_table(action_items)

            with res_tab3:
                st.markdown(final_state.get("analysis", "No analysis available."))

            # ── Download section ─────────────────────────────────────────────
            st.markdown("---")
            st.markdown('<p class="section-header">📥 Export</p>', unsafe_allow_html=True)

            dl_col1, dl_col2 = st.columns(2)

            with dl_col1:
                # PDF download
                mom_data = final_state.get("mom_data")
                if mom_data:
                    try:
                        from services.pdf_service import generate_mom_pdf
                        pdf_bytes = generate_mom_pdf(mom_data)
                        st.download_button(
                            label="Download PDF Report",
                            data=pdf_bytes,
                            file_name=f"{club_name.replace(' ', '_')}_MoM_{meeting_date_str.replace(' ', '_')}.pdf",
                            mime="application/pdf",
                            use_container_width=True,
                        )
                    except Exception as e:
                        st.error(f"PDF generation failed: {e}")

            with dl_col2:
                # Markdown download
                mom_md = final_state.get("mom", "")
                if mom_md:
                    st.download_button(
                        label="📝 Download Markdown",
                        data=mom_md.encode("utf-8"),
                        file_name=f"{club_name.replace(' ', '_')}_MoM_{meeting_date_str.replace(' ', '_')}.md",
                        mime="text/markdown",
                        use_container_width=True,
                    )


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2: AI CHAT (With Memory)
# ══════════════════════════════════════════════════════════════════════════════

with tab2:
    st.markdown('<p class="section-header">AI Chat & Knowledge Q&A</p>', unsafe_allow_html=True)
    st.markdown("Ask anything about past meetings. The AI remembers context within this session!")
    
    col1, col2 = st.columns([1, 4])
    with col1:
        if st.button("🗑️ Clear Chat History", use_container_width=True):
            clear_chat_history(st.session_state)
            st.rerun()
            
    with col2:
        filter_by_club = st.checkbox(
            f"Filter by current club ({club_name})",
            value=False,
            help="Restrict search to meetings from the club configured in the sidebar.",
        )
            
    st.markdown("---")

    # Display chat messages from history
    for message in get_chat_history(st.session_state):
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # Accept user input
    if prompt := st.chat_input("Ask about past meetings..."):
        if not check_api_key():
            st.error("🔑 Please add your Groq API key in the sidebar.")
            st.stop()
            
        # Add user message to UI and memory
        with st.chat_message("user"):
            st.markdown(prompt)
        add_user_message(st.session_state, prompt)

        # Generate response
        with st.chat_message("assistant"):
            with st.spinner("Thinking & searching knowledge base..."):
                try:
                    from rag.vector_store import get_collection_count
                    if get_collection_count() == 0:
                        response_msg = "📭 The knowledge base is empty. Generate some meeting minutes first!"
                        st.warning(response_msg)
                        add_assistant_message(st.session_state, response_msg)
                    else:
                        from rag.rag_chain import answer_question
                        chat_history_str = format_chat_history_for_prompt(st.session_state)
                        
                        result = answer_question(
                            question=prompt,
                            filter_club=club_name if filter_by_club else None,
                            chat_history=chat_history_str,
                            top_k=5
                        )
                        
                        answer = result["answer"]
                        st.markdown(answer)
                        
                        # Show sources in expander
                        if result.get("source_docs"):
                            with st.expander("View Sources", expanded=False):
                                for i, doc in enumerate(result["source_docs"], 1):
                                    meta = doc.metadata
                                    source_type = "MoM" if meta.get("source") == "minutes_of_meeting" else "Transcript"
                                    st.markdown(f"**Source {i}: {source_type} | {meta.get('club_name')} ({meta.get('meeting_date')})**")
                                    st.caption(f"{doc.page_content[:200]}...")
                                    st.divider()
                        
                        add_assistant_message(st.session_state, answer)

                except Exception as e:
                    error_msg = f"❌ Q&A failed: {e}"
                    st.error(error_msg)
                    logger.error(f"RAG error: {e}", exc_info=True)
                    add_assistant_message(st.session_state, error_msg)


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3: KNOWLEDGE BASE MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

with tab3:
    st.markdown('<p class="section-header">Knowledge Base Management</p>', unsafe_allow_html=True)
    st.markdown("View and manage meetings stored in the vector database used for Q&A.")
    
    try:
        from rag.vector_store import list_stored_meetings, delete_meeting_documents
        
        stored_meetings = list_stored_meetings()
        
        if not stored_meetings:
            st.info("The knowledge base is empty. Meetings are auto-saved here after generation.")
        else:
            for mtg in stored_meetings:
                with st.container():
                    st.markdown(f"""
                    <div class="kb-card">
                        <div class="history-title">{mtg['club_name']} - {mtg['meeting_title']}</div>
                        <div class="history-meta">📅 {mtg['meeting_date']}</div>
                        <div>
                            <span class="pill-badge">Chunks: {mtg['chunk_count']}</span>
                            <span class="pill-badge">Sources: {', '.join(mtg['source_types'])}</span>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                    
                    if st.button("🗑️ Delete from KB", key=f"del_kb_{mtg['club_name']}_{mtg['meeting_date']}", help="Removes from vector search"):
                        deleted = delete_meeting_documents(mtg['club_name'], mtg['meeting_date'])
                        if deleted > 0:
                            st.success(f"Deleted {deleted} chunks. Refreshing...")
                            st.rerun()
                            
                    st.markdown("<br/>", unsafe_allow_html=True)

    except Exception as e:
        st.error(f"Could not load Knowledge Base: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 4: MEETING HISTORY
# ══════════════════════════════════════════════════════════════════════════════

with tab4:
    st.markdown('<p class="section-header">Generated Meeting History</p>', unsafe_allow_html=True)
    st.markdown("All successfully generated minutes are saved here permanently.")
    
    try:
        from services.history_service import get_all_meetings, delete_meeting
        history_entries = get_all_meetings()
        
        if not history_entries:
            st.info("No meeting history found.")
        else:
            for entry in history_entries:
                with st.expander(f"📝 {entry.get('club_name')} - {entry.get('meeting_date')} (Words: {entry.get('word_count')})"):
                    st.markdown(f"""
                    **Saved:** {entry.get('saved_at')}
                    
                    <span class="pill-badge">Action Items: {entry.get('action_item_count')}</span>
                    <span class="pill-badge" style="color: #f87171;">High Priority: {entry.get('high_priority_count')}</span>
                    """, unsafe_allow_html=True)
                    
                    st.markdown("---")
                    st.markdown(entry.get('mom_markdown', 'No MoM content'))
                    
                    colA, colB, colC = st.columns([1,1,2])
                    with colA:
                        if entry.get("mom_data"):
                            from services.pdf_service import generate_mom_pdf
                            try:
                                pdf_bytes = generate_mom_pdf(entry["mom_data"])
                                st.download_button(
                                    "PDF",
                                    data=pdf_bytes, 
                                    file_name=f"MoM_{entry['club_name']}_{entry['meeting_date']}.pdf",
                                    key=f"dl_pdf_{entry['id']}"
                                )
                            except Exception:
                                st.error("PDF generation failed")
                    with colB:
                        if st.button("🗑️ Delete", key=f"del_hist_{entry['id']}"):
                            delete_meeting(entry['id'])
                            st.rerun()
                            
    except Exception as e:
        st.error(f"Could not load History: {e}")
