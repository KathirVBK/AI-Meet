import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pytest
from fastapi.testclient import TestClient
from api_server import app
from database.connection import Base, engine, SessionLocal
from database.models import User, Meeting, Club, ClubMember, Token, ActionItem
import json

client = TestClient(app)

def test_club_admin_features_flow():
    db = SessionLocal()
    
    # 1. Setup test users and token
    test_admin = db.query(User).filter(User.email == "test_club_admin@example.com").first()
    if not test_admin:
        test_admin = User(id="ca_test_1", email="test_club_admin@example.com", name="Club Admin Tester", global_role="SUPER_ADMIN", is_active=True, password_hash="test")
        db.add(test_admin)
        db.commit()
        
    token_obj = db.query(Token).filter(Token.user_id == test_admin.id).first()
    if not token_obj:
        token_obj = Token(token="token_test_club_admin", user_id=test_admin.id)
        db.add(token_obj)
        db.commit()
        
    token = token_obj.token
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Setup or get test club
    club = db.query(Club).filter(Club.name == "Robotics Club Test").first()
    if not club:
        club = Club(name="Robotics Club Test", description="Testing robotics club features", is_active=True)
        db.add(club)
        db.commit()
        db.refresh(club)
        
    club_id = club.id
    
    # Feature 3 Test: Club Persona & Require Approval
    res = client.put(f"/api/admin/clubs/{club_id}/persona", headers=headers, json={
        "ai_persona": "Focus on technical architecture and hardware blockers.",
        "require_approval": True
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert "technical architecture" in data["persona"]["ai_persona"]
    assert data["persona"]["require_approval"] is True
    
    # Read persona back
    res_get_persona = client.get(f"/api/admin/clubs/{club_id}/persona", headers=headers)
    assert res_get_persona.status_code == 200
    assert res_get_persona.json()["persona"]["require_approval"] is True
    
    # Feature 5 Test: Agenda Templates CRUD
    res_tpl = client.post(f"/api/admin/clubs/{club_id}/agenda-templates", headers=headers, json={
        "title": "Weekly Sprint Agenda",
        "description": "Weekly robotics team sync",
        "agenda_items": ["Hardware Review", "Firmware Updates", "Blockers", "Action Items"]
    })
    assert res_tpl.status_code == 200, res_tpl.text
    tpl_data = res_tpl.json()["template"]
    tpl_id = tpl_data["id"]
    assert len(tpl_data["agenda_items"]) == 4
    
    res_list_tpl = client.get(f"/api/clubs/{club_id}/agenda-templates", headers=headers)
    assert res_list_tpl.status_code == 200
    assert any(t["id"] == tpl_id for t in res_list_tpl.json()["templates"])
    
    # Feature 1 Test: Meeting Approval Flow
    from services.history_service import save_meeting
    meeting_id = save_meeting(
        db=db,
        club_name=club.name,
        meeting_date="2026-09-16",
        transcript_preview="Test transcript preview...",
        mom_markdown="# MoM Preview",
        mom_data={"title": "Robotics Weekly", "decisions": [{"decision": "Order LiDAR sensor", "status": "Confirmed"}]},
        action_items=[{"task": "Order LiDAR sensor", "owner": "Alex", "deadline": "2026-09-10", "priority": "High"}],
        workflow_log=[],
        participants=["Alex", "Kathir"],
        created_by=test_admin.id,
        approval_status="PENDING_REVIEW"
    )
    
    # Fetch pending meetings
    res_pending = client.get("/api/admin/pending-meetings", headers=headers)
    assert res_pending.status_code == 200
    pending_list = res_pending.json()["meetings"]
    assert any(m["id"] == meeting_id for m in pending_list)
    
    # Approve meeting
    res_approve = client.put(f"/api/admin/meetings/{meeting_id}/approval", headers=headers, json={
        "status": "APPROVED",
        "notes": "Looks great, approved for club view."
    })
    assert res_approve.status_code == 200
    assert res_approve.json()["meeting"]["approval_status"] == "APPROVED"
    assert res_approve.json()["meeting"]["approval_notes"] == "Looks great, approved for club view."
    
    # Feature 2 Test: Action Items & Nudge
    res_items = client.get(f"/api/admin/club-action-items?club_id={club_id}", headers=headers)
    assert res_items.status_code == 200
    items = res_items.json()["action_items"]
    assert len(items) >= 1
    target_item = items[0]
    assert target_item["is_overdue"] is True  # 2026-09-10 is earlier than today 2026-09-16
    
    # Send Nudge
    res_nudge = client.post(f"/api/admin/action-items/{target_item['id']}/nudge", headers=headers)
    assert res_nudge.status_code == 200
    assert res_nudge.json()["action_item"]["nudge_count"] == 1
    assert res_nudge.json()["action_item"]["last_nudged_at"] is not None
    
    # Feature 4 Test: Monthly Club Report
    res_report = client.get(f"/api/admin/clubs/{club_id}/monthly-report?month=9&year=2026", headers=headers)
    assert res_report.status_code == 200
    rep = res_report.json()["report"]
    assert rep["total_meetings"] >= 1
    assert rep["total_decisions"] >= 1
    assert "# Robotics Club Test — Monthly Activity Report" in rep["report_markdown"]
    
    # Clean up test template
    res_del_tpl = client.delete(f"/api/admin/agenda-templates/{tpl_id}", headers=headers)
    assert res_del_tpl.status_code == 200
    
    db.close()
    print("ALL 5 CLUB ADMIN BACKEND FEATURES VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    test_club_admin_features_flow()
