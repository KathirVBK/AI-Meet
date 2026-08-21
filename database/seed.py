"""
Database seeder. Pre-populates the clubs table with the predefined club list.
Run on application startup to ensure clubs always exist.
"""
import logging
from sqlalchemy.orm import Session
from database.models import Club

logger = logging.getLogger(__name__)

PREDEFINED_CLUBS = [
    {"name": "AI & ML Club", "description": "Artificial Intelligence and Machine Learning club"},
    {"name": "Coding Club", "description": "Competitive programming and software development"},
    {"name": "Robotics Club", "description": "Robotics design, build, and competition"},
    {"name": "IoT Club", "description": "Internet of Things projects and workshops"},
    {"name": "Electronics Club", "description": "Electronics design and embedded systems"},
    {"name": "Design Club", "description": "UI/UX design and creative media"},
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
