"""
Database seeder. Pre-populates the clubs table and default accounts.
Run on application startup to ensure clubs and super admin accounts always exist.
"""
import logging
import uuid
from sqlalchemy.orm import Session
from database.models import Club, User, ClubMember
from services.user_service import hash_password

logger = logging.getLogger(__name__)

PREDEFINED_CLUBS = [
    {"name": "AI & ML Club", "description": "Artificial Intelligence and Machine Learning club"},
    {"name": "Coding Club", "description": "Competitive programming and software development"},
    {"name": "Robotics Club", "description": "Robotics design, build, and competition"},
    {"name": "IoT Club", "description": "Internet of Things projects and workshops"},
    {"name": "Electronics Club", "description": "Electronics design and embedded systems"},
    {"name": "Design Club", "description": "UI/UX design and creative media"},
]

DEFAULT_USERS = [
    {
        "email": "kathirvb24@gmail.com",
        "name": "Kathir Super Admin",
        "global_role": "SUPER_ADMIN",
        "password": "vbk241005",
        "department": "Administration"
    },
    {
        "email": "karthi.ec23@bitsathy.ac.in",
        "name": "Karthi Admin",
        "global_role": "ADMIN",
        "password": "password123",
        "department": "Electronics & Communication"
    },
    {
        "email": "nijanth.al23@bitsathy.ac.in",
        "name": "Nijanth Admin",
        "global_role": "ADMIN",
        "password": "password123",
        "department": "Artificial Intelligence"
    },
    {
        "email": "kkathir.ec23@bitsathy.ac.in",
        "name": "Kathir Student",
        "global_role": "STUDENT",
        "password": "password123",
        "department": "Electronics & Communication"
    },
    {
        "email": "test@example.com",
        "name": "Test User",
        "global_role": "STUDENT",
        "password": "password123",
        "department": "Computer Science"
    }
]


def seed_clubs(db: Session):
    """Insert predefined clubs if they don't already exist."""
    existing = {c.name for c in db.query(Club.name).all()}
    added = 0
    for club_data in PREDEFINED_CLUBS:
        if club_data["name"] not in existing:
            db.add(Club(**club_data))
            added += 1
    if added:
        db.commit()
        logger.info("Seeded %d new clubs into the database.", added)
    else:
        logger.info("All clubs already exist. No seeding needed.")


def seed_default_users(db: Session):
    """Ensure essential user accounts (including Super Admin) exist and are active."""
    for u_info in DEFAULT_USERS:
        email = u_info["email"].lower().strip()
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                id=str(uuid.uuid4())[:8],
                email=email,
                name=u_info["name"],
                global_role=u_info["global_role"],
                password_hash=hash_password(u_info["password"]),
                department=u_info.get("department"),
                is_active=True
            )
            db.add(user)
            db.commit()
            logger.info("Created default user: %s (%s)", email, u_info["global_role"])
        else:
            # Ensure super admin remains active and with super admin role
            if u_info["global_role"] == "SUPER_ADMIN":
                user.global_role = "SUPER_ADMIN"
                user.is_active = True
                if not user.password_hash:
                    user.password_hash = hash_password(u_info["password"])
                db.commit()


def seed_all(db: Session):
    """Run all seed operations."""
    seed_clubs(db)
    seed_default_users(db)

