import sqlite3
import requests

try:
    reg_res = requests.post("http://127.0.0.1:5000/api/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "password",
        "studentId": "TEST-123",
        "club": "None",
        "year": "1",
        "department": "CS"
    })
    print("Reg Code:", reg_res.status_code)
    print("Reg Body:", reg_res.text)

    response = requests.post("http://127.0.0.1:5000/api/auth/login", json={"email": "test@example.com", "password": "password"})
    print("Status Code:", response.status_code)
    print("Response Body:", response.text)
except Exception as e:
    print("Error:", e)

conn = sqlite3.connect('data/meetmind.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
print("Tables:", cursor.fetchall())
