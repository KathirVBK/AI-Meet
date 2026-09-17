import os
import sys
import argparse
import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

# Add parent dir to path so we can import from database/
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database.connection import SessionLocal
from database.models import Meeting, User

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

def migrate_roles(db: Session, dry_run: bool = False):
    logger.info("--- Starting Role Migration ---")
    users = db.query(User).all()
    super_admin_migrated = 0
    admin_migrated = 0
    student_migrated = 0
    unknown_roles = []

    for u in users:
        old_role = u.global_role
        if old_role in ("Super Admin", "SUPER_ADMIN"):
            new_role = "SUPER_ADMIN"
            if old_role != new_role:
                super_admin_migrated += 1
        elif old_role in ("Admin", "ADMIN", "CLUB_ADMIN"):
            new_role = "ADMIN"
            if old_role != new_role:
                admin_migrated += 1
        elif old_role in ("Student", "STUDENT"):
            new_role = "STUDENT"
            if old_role != new_role:
                student_migrated += 1
        else:
            unknown_roles.append(f"User {u.id} ({u.email}): {old_role}")
            continue
        
        if old_role != new_role:
            u.global_role = new_role

    if not dry_run:
        db.commit()
    
    logger.info(f"SUPER_ADMIN migrated: {super_admin_migrated}")
    logger.info(f"ADMIN migrated: {admin_migrated}")
    logger.info(f"STUDENT migrated: {student_migrated}")
    logger.info(f"Unknown roles: {len(unknown_roles)}")
    for unknown in unknown_roles:
        logger.warning(f"  - {unknown}")

def migrate_meetings(db: Session, dry_run: bool = False):
    logger.info("--- Starting Meeting created_by Migration ---")
    meetings = db.query(Meeting).all()
    users = {u.email: u.id for u in db.query(User).all()}
    user_ids = set(users.values())

    total = len(meetings)
    already_valid = 0
    converted = 0
    orphaned = 0
    failed = 0

    for m in meetings:
        cb = m.created_by
        if not cb:
            # Maybe created_by is null, skip
            continue
            
        if cb in user_ids:
            already_valid += 1
        elif cb in users:
            # It's an email that exists in the users dictionary
            m.created_by = users[cb]
            converted += 1
        else:
            # Try to see if there's any other case, otherwise it's orphaned
            # Do not guess or delete
            orphaned += 1
            logger.warning(
                f"Orphaned Meeting: meeting_id={m.id}, "
                f"old_created_by='{cb}', "
                f"club_name='{m.club_name}', "
                f"title='{m.title}', "
                f"date='{m.meeting_date}'"
            )

    if not dry_run:
        try:
            db.commit()
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database commit failed: {e}")
            failed = converted
            converted = 0

    logger.info("--- Meeting Migration Report ---")
    logger.info(f"Total meetings: {total}")
    logger.info(f"Already valid: {already_valid}")
    logger.info(f"Converted from email: {converted}")
    logger.info(f"Orphaned: {orphaned}")
    logger.info(f"Failed: {failed}")

def run_migration(dry_run: bool = False):
    db: Session = SessionLocal()
    try:
        if dry_run:
            logger.info("=== DRY RUN MODE: No changes will be committed ===")
        
        migrate_roles(db, dry_run=dry_run)
        migrate_meetings(db, dry_run=dry_run)
        
    except Exception as e:
        logger.error(f"Migration error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate Meeting.created_by from email to user.id")
    parser.add_argument("--dry-run", action="store_true", help="Report what would happen without committing")
    args = parser.parse_args()
    run_migration(dry_run=args.dry_run)
