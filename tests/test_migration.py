import os
import sys
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent dir to path so we can import from database/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.models import Base, User, Meeting
from database.migrations.migrate_meeting_created_by import migrate_roles, migrate_meetings

class TestMigration(unittest.TestCase):
    def setUp(self):
        # Create a fresh in-memory SQLite database for each test
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db = self.SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_1_email_migration(self):
        """Test that created_by is correctly migrated from email to user.id"""
        user = User(id="user123", email="test@example.com", name="Test", password_hash="hash")
        self.db.add(user)
        
        meeting = Meeting(id="meet1", created_by="test@example.com")
        self.db.add(meeting)
        self.db.commit()
        
        migrate_meetings(self.db)
        
        migrated_meeting = self.db.query(Meeting).filter(Meeting.id == "meet1").first()
        self.assertEqual(migrated_meeting.created_by, "user123")

    def test_2_already_correct_meeting(self):
        """Test that already-correct meeting is left unchanged"""
        user = User(id="user123", email="test@example.com", name="Test", password_hash="hash")
        self.db.add(user)
        
        meeting = Meeting(id="meet1", created_by="user123")
        self.db.add(meeting)
        self.db.commit()
        
        migrate_meetings(self.db)
        
        migrated_meeting = self.db.query(Meeting).filter(Meeting.id == "meet1").first()
        self.assertEqual(migrated_meeting.created_by, "user123")

    def test_3_unknown_email(self):
        """Test that unknown email is reported as orphaned and left unchanged"""
        user = User(id="user123", email="test@example.com", name="Test", password_hash="hash")
        self.db.add(user)
        
        meeting = Meeting(id="meet1", created_by="unknown@example.com")
        self.db.add(meeting)
        self.db.commit()
        
        migrate_meetings(self.db)
        
        migrated_meeting = self.db.query(Meeting).filter(Meeting.id == "meet1").first()
        self.assertEqual(migrated_meeting.created_by, "unknown@example.com")

    def test_4_role_migration(self):
        """Test that all known roles are migrated correctly"""
        users = [
            User(id="1", email="1@x.com", name="X", password_hash="X", global_role="CLUB_ADMIN"),
            User(id="2", email="2@x.com", name="X", password_hash="X", global_role="Admin"),
            User(id="3", email="3@x.com", name="X", password_hash="X", global_role="Super Admin"),
            User(id="4", email="4@x.com", name="X", password_hash="X", global_role="Student"),
        ]
        self.db.add_all(users)
        self.db.commit()
        
        migrate_roles(self.db)
        
        self.assertEqual(self.db.query(User).filter(User.id == "1").first().global_role, "ADMIN")
        self.assertEqual(self.db.query(User).filter(User.id == "2").first().global_role, "ADMIN")
        self.assertEqual(self.db.query(User).filter(User.id == "3").first().global_role, "SUPER_ADMIN")
        self.assertEqual(self.db.query(User).filter(User.id == "4").first().global_role, "STUDENT")

    def test_5_unknown_role(self):
        """Test that unknown roles are left alone"""
        user = User(id="1", email="1@x.com", name="X", password_hash="X", global_role="XYZ_ADMIN")
        self.db.add(user)
        self.db.commit()
        
        migrate_roles(self.db)
        
        self.assertEqual(self.db.query(User).filter(User.id == "1").first().global_role, "XYZ_ADMIN")

if __name__ == "__main__":
    unittest.main()
