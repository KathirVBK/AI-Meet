import sys
from database.connection import SessionLocal, init_db
from database.models import User
from services.user_service import register_user, update_user_role
import bcrypt

def seed_super_admin():
    init_db()
    db = SessionLocal()
    
    email = "kathirvb24@gmail.com"
    password = "vbk241005"
    name = "Kathir Super Admin"
    
    # Check if user already exists
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Register user
        print(f"Creating new Super Admin user: {email}")
        user_data = {
            "name": name,
            "email": email,
            "password": password,
            "studentId": "ADMIN-001",
            "club": "Admin Club",
            "year": "N/A",
            "department": "Administration"
        }
        try:
            register_user(db, user_data)
        except Exception as e:
            print(f"Error registering user: {e}")
            db.close()
            return
            
        # Get the created user
        user = db.query(User).filter(User.email == email).first()
    else:
        print(f"User {email} already exists. Updating password and role...")
        from services.user_service import hash_password
        user.password_hash = hash_password(password)
        db.commit()

    if user:
        print(f"Setting {email} to SUPER_ADMIN...")
        update_user_role(db, user.id, "SUPER_ADMIN")
        print("Super Admin seeded successfully.")
    
    db.close()

if __name__ == "__main__":
    seed_super_admin()
