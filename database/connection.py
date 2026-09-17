"""
Database connection and session management.
Uses SQLite for local development, easily swappable to PostgreSQL.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.models import Base

# Database file lives in the data/ directory
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "meetmind.db")

# SQLite connection string (swap this line for PostgreSQL)
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite + FastAPI
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


from sqlalchemy import text

def init_db():
    """Create all tables if they don't exist, and add new columns if missing."""
    Base.metadata.create_all(bind=engine)

    # SQLite column auto-migration helper
    with engine.begin() as conn:
        def get_existing_cols(table_name):
            try:
                res = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                return [row[1] for row in res]
            except Exception:
                return []

        # 2. meetings
        meeting_cols = get_existing_cols("meetings")
        if meeting_cols:
            if "approval_status" not in meeting_cols:
                conn.execute(text("ALTER TABLE meetings ADD COLUMN approval_status VARCHAR DEFAULT 'APPROVED'"))
            if "approval_notes" not in meeting_cols:
                conn.execute(text("ALTER TABLE meetings ADD COLUMN approval_notes TEXT"))
            if "approved_by" not in meeting_cols:
                conn.execute(text("ALTER TABLE meetings ADD COLUMN approved_by VARCHAR"))
            if "approved_at" not in meeting_cols:
                conn.execute(text("ALTER TABLE meetings ADD COLUMN approved_at DATETIME"))

        # 3. action_items
        ai_cols = get_existing_cols("action_items")
        if ai_cols:
            if "nudge_count" not in ai_cols:
                conn.execute(text("ALTER TABLE action_items ADD COLUMN nudge_count INTEGER DEFAULT 0"))
            if "last_nudged_at" not in ai_cols:
                conn.execute(text("ALTER TABLE action_items ADD COLUMN last_nudged_at DATETIME"))
                
        # 4. audit_logs
        audit_cols = get_existing_cols("audit_logs")
        if audit_cols:
            if "user_email" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN user_email VARCHAR"))


# Always create tables on import so the DB is ready before the first request
init_db()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
