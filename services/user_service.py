"""
User Management Service — SQLAlchemy Edition.
Handles registration, login, token validation, and profile updates
against the relational database.
"""
import hashlib
import uuid
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from database.models import User, Token, Club, ClubMember

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Simple SHA-256 hash for demonstration purposes."""
    return hashlib.sha256(password.encode()).hexdigest()


def _user_to_dict(user: User) -> dict:
    """Convert a User ORM object to a safe dict (no password hash)."""
    clubs = []
    for m in user.club_memberships:
        clubs.append({
            "club_name": m.club.name if m.club else "",
            "role": m.role,
            "status": m.status,
            "joined_date": m.joined_at.isoformat() if m.joined_at else "",
        })
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "student_id": user.student_id,
        "department": user.department,
        "year": user.year,
        "global_role": user.global_role,
        "clubs": clubs,
    }


def register_user(db: Session, user_data: dict) -> Dict[str, Any]:
    """Register a new user and return token + user dict."""
    email = user_data.get("email", "").lower().strip()

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("User with this email already exists.")

    user = User(
        name=user_data.get("name", ""),
        student_id=user_data.get("studentId", ""),
        email=email,
        password_hash=hash_password(user_data.get("password", "")),
        department=user_data.get("department", ""),
        year=user_data.get("year", ""),
        global_role="Student",
    )
    db.add(user)
    db.flush()  # Get user.id

    # Create club membership
    club_name = user_data.get("club", "")
    if club_name:
        club = db.query(Club).filter(Club.name == club_name).first()
        if club:
            membership = ClubMember(user_id=user.id, club_id=club.id, role="Member", status="Active")
            db.add(membership)

    # Generate token
    token_str = str(uuid.uuid4())
    db.add(Token(token=token_str, user_id=user.id))
    db.commit()
    db.refresh(user)

    return {"token": token_str, "user": _user_to_dict(user)}


def login_user(db: Session, email: str, password: str) -> Optional[Dict[str, Any]]:
    """Verify credentials and return token + user dict."""
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if user.password_hash != hash_password(password):
        return None

    token_str = str(uuid.uuid4())
    db.add(Token(token=token_str, user_id=user.id))
    db.commit()

    return {"token": token_str, "user": _user_to_dict(user)}


def get_user_by_token(db: Session, token: str) -> Optional[dict]:
    """Look up a user by their session token."""
    tok = db.query(Token).filter(Token.token == token).first()
    if not tok:
        return None
    user = tok.user
    if not user:
        return None
    return _user_to_dict(user)


def get_user_by_email(db: Session, email: str) -> Optional[dict]:
    """Look up a user by email."""
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user:
        return None
    return _user_to_dict(user)


def update_user_profile(db: Session, email: str, updates: dict) -> Optional[dict]:
    """Update user profile fields."""
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user:
        return None

    if "name" in updates and updates["name"] is not None:
        user.name = updates["name"]
    if "department" in updates and updates["department"] is not None:
        user.department = updates["department"]
    if "year" in updates and updates["year"] is not None:
        user.year = updates["year"]

    # Handle club update (replaces all memberships with a single new one)
    if "clubs" in updates:
        for club_data in updates["clubs"]:
            club_name = club_data.get("club_name", "")
            club = db.query(Club).filter(Club.name == club_name).first()
            if club:
                # Check if already a member
                existing = db.query(ClubMember).filter(
                    ClubMember.user_id == user.id,
                    ClubMember.club_id == club.id,
                ).first()
                if not existing:
                    db.add(ClubMember(
                        user_id=user.id,
                        club_id=club.id,
                        role=club_data.get("role", "Member"),
                        status=club_data.get("status", "Active"),
                    ))

    db.commit()
    db.refresh(user)
    return _user_to_dict(user)
