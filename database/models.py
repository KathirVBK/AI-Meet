"""
SQLAlchemy ORM models for MeetMind.
Defines the relational schema: Users, Clubs, ClubMembers, Meetings,
MeetingParticipants, ActionItems, Decisions.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Text, Float, DateTime, ForeignKey, Boolean, Enum as SAEnum
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


def _uuid():
    return str(uuid.uuid4())[:8]


# ═══════════════════════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════════════════════
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    student_id = Column(String, unique=True, nullable=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    department = Column(String, nullable=True)
    year = Column(String, nullable=True)
    global_role = Column(String, default="Student")  # Student | Admin
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    club_memberships = relationship("ClubMember", back_populates="user", cascade="all, delete-orphan")
    created_meetings = relationship("Meeting", back_populates="creator", foreign_keys="Meeting.created_by")
    tokens = relationship("Token", back_populates="user", cascade="all, delete-orphan")


# ═══════════════════════════════════════════════════════════════════════════════
# TOKENS (session persistence)
# ═══════════════════════════════════════════════════════════════════════════════
class Token(Base):
    __tablename__ = "tokens"

    token = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tokens")


# ═══════════════════════════════════════════════════════════════════════════════
# CLUBS
# ═══════════════════════════════════════════════════════════════════════════════
class Club(Base):
    __tablename__ = "clubs"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("ClubMember", back_populates="club", cascade="all, delete-orphan")
    meetings = relationship("Meeting", back_populates="club")


# ═══════════════════════════════════════════════════════════════════════════════
# CLUB MEMBERS (many-to-many: User ↔ Club with role metadata)
# ═══════════════════════════════════════════════════════════════════════════════
class ClubMember(Base):
    __tablename__ = "club_members"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    club_id = Column(String, ForeignKey("clubs.id"), nullable=False)
    role = Column(String, default="Member")  # Member | Coordinator
    status = Column(String, default="Active")  # Active | Inactive
    joined_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="club_memberships")
    club = relationship("Club", back_populates="members")


# ═══════════════════════════════════════════════════════════════════════════════
# MEETINGS
# ═══════════════════════════════════════════════════════════════════════════════
class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, nullable=True)
    club_id = Column(String, ForeignKey("clubs.id"), nullable=True)
    club_name = Column(String, nullable=True)  # Denormalized for quick access
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    meeting_date = Column(String, nullable=True)
    duration = Column(Float, nullable=True)
    transcript = Column(Text, nullable=True)
    labelled_transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    mom_markdown = Column(Text, nullable=True)
    mom_data_json = Column(Text, nullable=True)  # JSON string for full MoM data
    speaker_mapping_json = Column(Text, nullable=True)
    transcript_segments_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="created_meetings", foreign_keys=[created_by])
    club = relationship("Club", back_populates="meetings")
    participants = relationship("MeetingParticipant", back_populates="meeting", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="meeting", cascade="all, delete-orphan")
    decisions = relationship("Decision", back_populates="meeting", cascade="all, delete-orphan")


# ═══════════════════════════════════════════════════════════════════════════════
# MEETING PARTICIPANTS (many-to-many: Meeting ↔ User/name)
# ═══════════════════════════════════════════════════════════════════════════════
class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"

    id = Column(String, primary_key=True, default=_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    participant_name = Column(String, nullable=False)  # Name string (may not be a registered user)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)  # Optional FK if they are registered

    meeting = relationship("Meeting", back_populates="participants")


# ═══════════════════════════════════════════════════════════════════════════════
# ACTION ITEMS
# ═══════════════════════════════════════════════════════════════════════════════
class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(String, primary_key=True, default=_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    task = Column(Text, nullable=False)
    owner = Column(String, nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    deadline = Column(String, nullable=True)
    priority = Column(String, default="Medium")  # Low | Medium | High
    status = Column(String, default="Assigned")  # Assigned | Accepted | Pending | TBD
    evidence = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="action_items")


# ═══════════════════════════════════════════════════════════════════════════════
# DECISIONS
# ═══════════════════════════════════════════════════════════════════════════════
class Decision(Base):
    __tablename__ = "decisions"

    id = Column(String, primary_key=True, default=_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    decision = Column(Text, nullable=False)
    status = Column(String, default="Confirmed")
    evidence = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="decisions")
