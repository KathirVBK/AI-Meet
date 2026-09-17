from sqlalchemy.orm import Session
from database.models import Role, Permission, RolePermission, User
from typing import List, Dict

# Complete list of system permissions
ALL_PERMISSIONS = {
    "meetings.view_authorized": "View own/club/participated meetings",
    "meetings.create": "Create a new meeting",
    "action_plans.generate": "Generate new action plans",
    "admin.dashboard.view": "Access the admin dashboard",
    "clubs.meetings.manage": "Manage assigned-club meetings",
    "clubs.members.manage": "Manage members within an assigned club",
    "admin.roles.manage": "Manage roles and assign permissions",
    "admin.users.manage": "Manage global users",
    "admin.clubs.manage_global": "Create, update, or delete clubs globally",
    "admin.audit_logs.view": "View system audit logs",
    "admin.settings.manage": "Manage global system settings"
}

DEFAULT_ROLES = {
    "SUPER_ADMIN": list(ALL_PERMISSIONS.keys()),
    "ADMIN": [
        "meetings.view_authorized",
        "meetings.create",
        "action_plans.generate",
        "admin.dashboard.view",
        "clubs.meetings.manage",
        "clubs.members.manage"
    ],
    "STUDENT": [
        "meetings.view_authorized",
        "meetings.create",
        "action_plans.generate"
    ]
}

def seed_rbac(db: Session):
    """Seed the database with default roles and permissions."""
    # 1. Seed Permissions
    for perm_name, desc in ALL_PERMISSIONS.items():
        if not db.query(Permission).filter(Permission.name == perm_name).first():
            db.add(Permission(name=perm_name, description=desc))
            
    # 2. Seed Roles and assign default permissions
    for role_name, perms in DEFAULT_ROLES.items():
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            role = Role(name=role_name, description=f"Default {role_name} role")
            db.add(role)
            db.flush() # ensure role is available for RolePermission
            
            for p in perms:
                db.add(RolePermission(role_name=role.name, permission_name=p))
                
    db.commit()
    
    # 3. Migrate existing users to standard roles
    users = db.query(User).all()
    for u in users:
        if u.global_role in ("Super Admin", "SUPER_ADMIN"):
            u.global_role = "SUPER_ADMIN"
        elif u.global_role in ("Admin", "ADMIN", "CLUB_ADMIN"):
            u.global_role = "ADMIN"
        elif u.global_role in ("Student", "STUDENT"):
            u.global_role = "STUDENT"
        else:
            # Leave unknown roles unchanged for the migration script to log
            pass
    db.commit()

def has_permission(db: Session, role_name: str, permission_name: str) -> bool:
    """Check if a specific role has a specific permission."""
    rp = db.query(RolePermission).filter(
        RolePermission.role_name == role_name,
        RolePermission.permission_name == permission_name
    ).first()
    return rp is not None

def get_all_roles(db: Session) -> List[Dict]:
    roles = db.query(Role).all()
    result = []
    for r in roles:
        perms = [rp.permission_name for rp in r.permissions]
        result.append({
            "name": r.name,
            "description": r.description,
            "permissions": perms
        })
    return result

def get_all_permissions(db: Session) -> List[Dict]:
    perms = db.query(Permission).all()
    return [{"name": p.name, "description": p.description} for p in perms]

def assign_permission_to_role(db: Session, role_name: str, permission_name: str):
    rp = db.query(RolePermission).filter(
        RolePermission.role_name == role_name,
        RolePermission.permission_name == permission_name
    ).first()
    if not rp:
        db.add(RolePermission(role_name=role_name, permission_name=permission_name))
        db.commit()
    return True

def remove_permission_from_role(db: Session, role_name: str, permission_name: str):
    rp = db.query(RolePermission).filter(
        RolePermission.role_name == role_name,
        RolePermission.permission_name == permission_name
    ).first()
    if rp:
        db.delete(rp)
        db.commit()
    return True

# ═══════════════════════════════════════════════════════════════════════════════
# RESOURCE AUTHORIZATION HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def is_coordinator_for_club_by_name(db: Session, user: dict, club_name: str) -> bool:
    """Check if the user is a Coordinator for the given club name."""
    if user.get("global_role") == "SUPER_ADMIN":
        return True
    if user.get("global_role") != "ADMIN":
        return False
        
    from database.models import ClubMember, Club
    cm = db.query(ClubMember).join(Club).filter(
        ClubMember.user_id == user.get("id"),
        Club.name == club_name,
        ClubMember.role == "Coordinator"
    ).first()
    return cm is not None

def is_coordinator_for_club_by_id(db: Session, user: dict, club_id: str) -> bool:
    """Check if the user is a Coordinator for the given club ID."""
    if user.get("global_role") == "SUPER_ADMIN":
        return True
    if user.get("global_role") != "ADMIN":
        return False
        
    from database.models import ClubMember
    cm = db.query(ClubMember).filter(
        ClubMember.user_id == user.get("id"),
        ClubMember.club_id == club_id,
        ClubMember.role == "Coordinator"
    ).first()
    return cm is not None

def can_access_meeting(db: Session, user: dict, meeting) -> bool:
    """Centralized authorization check for meeting access."""
    if user.get("global_role") == "SUPER_ADMIN":
        return True
        
    user_id = user.get("id")
    user_name = user.get("name")
    
    # Check if meeting is a dict or SQLAlchemy model
    if isinstance(meeting, dict):
        meeting_created_by = meeting.get("created_by")
        meeting_club_name = meeting.get("club_name")
        meeting_participants = meeting.get("participants", [])
        is_participant = user_name in meeting_participants
    else:
        meeting_created_by = meeting.created_by
        meeting_club_name = meeting.club_name
        is_participant = any(p.participant_name == user_name for p in meeting.participants)
    
    # Creator check
    is_creator = (meeting_created_by == user_id)
    
    # Admin coordinator check
    if user.get("global_role") == "ADMIN":
        if is_coordinator_for_club_by_name(db, user, meeting_club_name):
            return True
            
    # Student club membership check
    user_clubs = [c.get("club_name") for c in user.get("clubs", [])]
    is_club_member = (meeting_club_name in user_clubs)
    
    return is_creator or is_participant or is_club_member
