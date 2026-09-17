import json
from sqlalchemy.orm import Session
from database.models import AuditLog, SystemSetting

def log_audit_action(db: Session, user_id: str, user_email: str, action: str, details: dict = None):
    """Log an administrative action."""
    log = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        details=json.dumps(details) if details else None
    )
    db.add(log)
    db.commit()

def get_all_audit_logs(db: Session, limit: int = 100):
    """Retrieve the most recent audit logs."""
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_email": log.user_email,
            "action": log.action,
            "details": json.loads(log.details) if log.details else {},
            "timestamp": log.timestamp.isoformat()
        }
        for log in logs
    ]

def get_system_settings(db: Session):
    """Retrieve all system settings."""
    settings = db.query(SystemSetting).all()
    return {s.key: json.loads(s.value) for s in settings}

def update_system_setting(db: Session, key: str, value: dict, description: str = None):
    """Update or create a system setting."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        setting.value = json.dumps(value)
        if description:
            setting.description = description
    else:
        setting = SystemSetting(key=key, value=json.dumps(value), description=description)
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return {setting.key: json.loads(setting.value)}
