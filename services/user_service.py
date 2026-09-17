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
from services.admin_service import log_audit_action

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
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else "",
        "clubs": clubs,
    }


def register_user(db: Session, user_data: dict) -> Dict[str, Any]:
    """Register a new user and return token + user dict."""
    email = user_data.get("email", "").lower().strip()

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("User with this email already exists.")

    student_id = user_data.get("studentId", "").strip()
    if student_id:
        existing_student = db.query(User).filter(User.student_id == student_id).first()
        if existing_student:
            raise ValueError("User with this student ID already exists.")

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

    log_audit_action(db, user.id, user.email, "ACCOUNT_CREATED", {
        "target_entity": "User",
        "target_id": user.id
    })

    return {"token": token_str, "user": _user_to_dict(user)}


def login_user(db: Session, email: str, password: str) -> Optional[Dict[str, Any]]:
    """Verify credentials and return token + user dict."""
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not user.is_active:
        raise ValueError("Your account has been suspended.")
    if user.password_hash != hash_password(password):
        return None

    token_str = str(uuid.uuid4())
    db.add(Token(token=token_str, user_id=user.id))
    db.commit()
    
    log_audit_action(db, user.id, user.email, "LOGIN", {
        "target_entity": "User",
        "target_id": user.id
    })

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
    
    log_audit_action(db, user.id, user.email, "PROFILE_UPDATED", {
        "target_entity": "User",
        "target_id": user.id
    })
    
    return _user_to_dict(user)


def get_all_users(db: Session) -> list[dict]:
    """Return all users in the system."""
    users = db.query(User).all()
    return [_user_to_dict(u) for u in users]


def update_user_role(db: Session, user_id: str, global_role: str) -> Optional[dict]:
    """Update a user's global role (e.g. Admin or Student)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
        
    user.global_role = global_role
    db.commit()
    db.refresh(user)
    
    return _user_to_dict(user)


def update_user_status(db: Session, user_id: str, is_active: bool) -> Optional[dict]:
    """Suspend or activate a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
        
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    
    return _user_to_dict(user)


def add_user_to_club(db: Session, user_id: str, club_name: str, role: str = "Member") -> Optional[dict]:
    """Assign a user to a club."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")
        
    club = db.query(Club).filter(Club.name == club_name).first()
    if not club:
        raise ValueError("Club not found")
        
    existing = db.query(ClubMember).filter(
        ClubMember.user_id == user.id,
        ClubMember.club_id == club.id
    ).first()
    
    if existing:
        existing.role = role
        existing.status = "Active"
    else:
        db.add(ClubMember(user_id=user.id, club_id=club.id, role=role, status="Active"))
        
    db.commit()
    db.refresh(user)
    
    return _user_to_dict(user)


def remove_user_from_club(db: Session, user_id: str, club_name: str) -> Optional[dict]:
    """Remove a user from a club."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")
        
    club = db.query(Club).filter(Club.name == club_name).first()
    if not club:
        raise ValueError("Club not found")
        
    existing = db.query(ClubMember).filter(
        ClubMember.user_id == user.id,
        ClubMember.club_id == club.id
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        
    db.refresh(user)
    return _user_to_dict(user)
