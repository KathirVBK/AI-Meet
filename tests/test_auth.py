import pytest
from fastapi.testclient import TestClient
from api_server import app
from database.connection import Base, engine, SessionLocal
from database.models import User, Meeting, Club, ClubMember, Token
import uuid
import json

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Clean up previous data
    db.query(Token).delete()
    db.query(Meeting).delete()
    db.query(ClubMember).delete()
    db.query(Club).delete()
    db.query(User).delete()
    
    from database.models import Role, Permission, RolePermission
    db.query(RolePermission).delete()
    db.query(Role).delete()
    db.query(Permission).delete()
    db.commit()

    # Seed RBAC
    from services.rbac_service import seed_rbac
    seed_rbac(db)

    # Create users
    super_admin = User(id="sa1", email="super@example.com", name="Super", global_role="SUPER_ADMIN", is_active=True, password_hash="hash")
    admin1 = User(id="a1", email="admin1@example.com", name="Admin1", global_role="ADMIN", is_active=True, password_hash="hash")
    admin2 = User(id="a2", email="admin2@example.com", name="Admin2", global_role="ADMIN", is_active=True, password_hash="hash")
    student = User(id="s1", email="student@example.com", name="Student1", global_role="STUDENT", is_active=True, password_hash="hash")
    student2 = User(id="s2", email="student2@example.com", name="Student2", global_role="STUDENT", is_active=True, password_hash="hash")
    
    db.add_all([super_admin, admin1, admin2, student, student2])
    db.commit()

    # Create tokens
    sa_token = "token-sa"
    a1_token = "token-a1"
    a2_token = "token-a2"
    s1_token = "token-s1"
    
    db.add_all([
        Token(token=sa_token, user_id=super_admin.id),
        Token(token=a1_token, user_id=admin1.id),
        Token(token=a2_token, user_id=admin2.id),
        Token(token=s1_token, user_id=student.id),
    ])
    db.commit()

    # Create clubs
    club1 = Club(id="c1", name="Club 1")
    club2 = Club(id="c2", name="Club 2")
    db.add_all([club1, club2])
    db.commit()

    # Club members
    db.add(ClubMember(user_id=admin1.id, club_id=club1.id, role="Coordinator"))
    db.add(ClubMember(user_id=admin2.id, club_id=club2.id, role="Coordinator"))
    db.add(ClubMember(user_id=student.id, club_id=club1.id, role="Member"))
    db.commit()

    # Create meetings
    m1 = Meeting(id="m1", title="M1", club_name="Club 1", created_by=admin1.id)
    m2 = Meeting(id="m2", title="M2", club_name="Club 2", created_by=admin2.id)
    m_student = Meeting(id="m3", title="M3", club_name="Club 2", created_by=student.id)
    # participant meeting
    m4 = Meeting(id="m4", title="M4", club_name="Club 2", created_by=admin2.id)

    db.add_all([m1, m2, m_student, m4])
    db.commit()
    
    from database.models import MeetingParticipant
    mp = MeetingParticipant(meeting_id="m4", participant_name="Student1")
    db.add(mp)
    db.commit()

    yield {
        "sa": sa_token,
        "a1": a1_token,
        "a2": a2_token,
        "s1": s1_token
    }

    # Teardown
    db.query(Token).delete()
    db.query(Meeting).delete()
    db.query(ClubMember).delete()
    db.query(Club).delete()
    db.query(User).delete()
    db.commit()
    db.close()

# Tests based on the requirements

def test_missing_token():
    # Test 12
    response = client.get("/api/meetings/m1")
    assert response.status_code == 403 or response.status_code == 401

def test_super_admin_access_any(setup_db):
    # Test 1, 11
    tokens = setup_db
    # Access any meeting
    res = client.get("/api/meetings/m2", headers={"Authorization": f"Bearer {tokens['sa']}"})
    assert res.status_code == 200
    # Access global admin API
    res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {tokens['sa']}"})
    assert res.status_code == 200

def test_admin_coordinated_club(setup_db):
    # Test 2
    tokens = setup_db
    res = client.get("/api/meetings/m1", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 200

def test_admin_uncoordinated_club_denied(setup_db):
    # Test 3
    tokens = setup_db
    res = client.get("/api/meetings/m2", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 403

def test_student_joined_club(setup_db):
    # Test 4
    tokens = setup_db
    res = client.get("/api/meetings/m1", headers={"Authorization": f"Bearer {tokens['s1']}"})
    assert res.status_code == 200

def test_student_unrelated_denied(setup_db):
    # Test 5
    tokens = setup_db
    # student is not in Club 2 and didn't create m2 and is not participant
    res = client.get("/api/meetings/m2", headers={"Authorization": f"Bearer {tokens['s1']}"})
    assert res.status_code == 403

def test_student_creator_access(setup_db):
    # Test 6
    tokens = setup_db
    res = client.get("/api/meetings/m3", headers={"Authorization": f"Bearer {tokens['s1']}"})
    assert res.status_code == 200

def test_student_participant_access(setup_db):
    # Test 7
    tokens = setup_db
    # m4 has student as participant but student is not in club 2
    res = client.get("/api/meetings/m4", headers={"Authorization": f"Bearer {tokens['s1']}"})
    assert res.status_code == 200

def test_admin_unassigned_club_api_denied(setup_db):
    # Test 8
    tokens = setup_db
    # a1 is coordinator for c1, tries to add member to c2
    res = client.post("/api/admin/clubs/c2/members", json={"email": "student2@example.com"}, headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 403

def test_student_admin_api_denied(setup_db):
    # Test 9
    tokens = setup_db
    res = client.get("/api/admin/clubs", headers={"Authorization": f"Bearer {tokens['s1']}"})
    assert res.status_code == 403

def test_admin_global_api_denied(setup_db):
    # Test 10
    tokens = setup_db
    # a1 tries to get all users
    res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 403

def test_admin_dashboard_stats(setup_db):
    tokens = setup_db
    # ADMIN -> dashboard -> 200 (Test 1)
    res = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_clubs"] == 1
    assert "Club 1" in [c["name"] for c in client.get("/api/admin/clubs", headers={"Authorization": f"Bearer {tokens['a1']}"}).json()["clubs"]]

    # STUDENT -> admin dashboard -> 403 (Test 2)
    res_student = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {tokens['s1']}"})
    assert res_student.status_code == 403

def test_admin_assigned_clubs_list(setup_db):
    tokens = setup_db
    # ADMIN -> sees only Coordinator clubs (Test 3)
    res = client.get("/api/admin/clubs", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 200
    clubs = res.json()["clubs"]
    assert len(clubs) == 1
    assert clubs[0]["id"] == "c1"

def test_admin_unrelated_club_details_denied(setup_db):
    tokens = setup_db
    # ADMIN -> GET /admin/clubs/<unrelated-id> -> 403 (Test 4 & 15)
    res = client.get("/api/admin/clubs/c2", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 403

def test_admin_assigned_members(setup_db):
    tokens = setup_db
    # ADMIN -> assigned club members -> 200 (Test 5)
    res = client.get("/api/admin/clubs/c1/members", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 200
    assert "members" in res.json()

def test_admin_unrelated_members(setup_db):
    tokens = setup_db
    # ADMIN -> unrelated club members -> 403 (Test 6)
    res = client.get("/api/admin/clubs/c2/members", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 403

def test_admin_global_restrictions(setup_db):
    tokens = setup_db
    # Test 10 - Admin role management -> 403
    res_roles = client.get("/api/admin/roles", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res_roles.status_code == 403
    
    # Test 11 - Admin global clubs -> 403
    res_clubs_post = client.post("/api/admin/clubs", json={"name": "New"}, headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res_clubs_post.status_code == 403
    
    # Test 12 - Admin audit logs -> 403
    res_logs = client.get("/api/admin/logs", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res_logs.status_code == 403
    
    # Test 13 - Admin settings -> 403
    res_settings = client.get("/api/admin/settings", headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res_settings.status_code == 403

def test_add_member_validation(setup_db):
    tokens = setup_db
    # ADMIN adding member with global role -> 400
    res = client.post("/api/admin/clubs/c1/members", json={"email": "student2@example.com", "role": "ADMIN"}, headers={"Authorization": f"Bearer {tokens['a1']}"})
    assert res.status_code == 400
    assert "Invalid club role" in res.text
