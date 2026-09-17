import json
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Optional
from database.models import Club, ClubMember, User, Meeting

def get_all_clubs_admin(db: Session) -> List[Dict]:
    """Get all clubs with aggregate statistics for the admin dashboard."""
    clubs = db.query(Club).all()
    result = []
    
    for club in clubs:
        # Get member count
        member_count = db.query(ClubMember).filter(ClubMember.club_id == club.id).count()
        
        # Get meeting count
        meeting_count = db.query(Meeting).filter(Meeting.club_id == club.id).count()
        
        # Get Coordinator/Admin
        coordinators = db.query(User).join(ClubMember).filter(
            ClubMember.club_id == club.id,
            ClubMember.role == "Coordinator"
        ).all()
        
        admin_names = [c.name for c in coordinators]
        admin_emails = [c.email for c in coordinators]
        
        result.append({
            "id": club.id,
            "name": club.name,
            "description": club.description,
            "is_active": club.is_active,
            "created_at": club.created_at.isoformat() if club.created_at else None,
            "member_count": member_count,
            "meeting_count": meeting_count,
            "admins": admin_names,
            "admin_emails": admin_emails
        })
        
    return result

def create_club(db: Session, name: str, description: str = None) -> Dict:
    """Create a new club."""
    existing = db.query(Club).filter(Club.name == name).first()
    if existing:
        raise ValueError("Club with this name already exists")
        
    club = Club(name=name, description=description, is_active=True)
    db.add(club)
    db.commit()
    db.refresh(club)
    return {
        "id": club.id,
        "name": club.name,
        "description": club.description,
        "is_active": club.is_active
    }

def update_club(db: Session, club_id: str, name: str, description: str = None) -> Optional[Dict]:
    """Update a club's basic details."""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return None
        
    club.name = name
    if description is not None:
        club.description = description
        
    db.commit()
    db.refresh(club)
    return {
        "id": club.id,
        "name": club.name,
        "description": club.description,
        "is_active": club.is_active
    }

def update_club_status(db: Session, club_id: str, is_active: bool) -> Optional[Dict]:
    """Activate or deactivate a club."""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return None
        
    club.is_active = is_active
    db.commit()
    db.refresh(club)
    return {
        "id": club.id,
        "name": club.name,
        "is_active": club.is_active
    }

def get_club_details(db: Session, club_id: str) -> Optional[Dict]:
    """Get deep details of a club including roster and meetings."""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return None
        
    members = db.query(ClubMember).filter(ClubMember.club_id == club.id).all()
    roster = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            roster.append({
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "role": m.role,
                "status": m.status
            })
            
    meetings = db.query(Meeting).filter(Meeting.club_id == club.id).all()
    meeting_list = [{
        "id": m.id,
        "title": m.title or "Meeting",
        "created_by": m.created_by,
        "meeting_date": m.meeting_date,
        "approval_status": m.approval_status or "APPROVED",
        "created_at": m.created_at.isoformat() if m.created_at else None
    } for m in meetings]

    
    return {
        "id": club.id,
        "name": club.name,
        "description": club.description,
        "is_active": club.is_active,
        "roster": roster,
        "meetings": meeting_list,
    }

def update_club_member_role(db: Session, club_id: str, user_id: str, role: str) -> bool:
    """Update a user's role within a club."""
    member = db.query(ClubMember).filter(ClubMember.club_id == club_id, ClubMember.user_id == user_id).first()
    if not member:
        return False
    member.role = role
    db.commit()
    return True

def remove_user_from_club_by_id(db: Session, club_id: str, user_id: str) -> bool:
    """Remove a user from a club."""
    member = db.query(ClubMember).filter(ClubMember.club_id == club_id, ClubMember.user_id == user_id).first()
    if not member:
        return False
    db.delete(member)
    db.commit()
    return True
