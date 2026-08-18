import requests

files = {'file': ('test.wav', b'testdata')}
data = {'club_name': 'Test', 'meeting_date': '2026-08-14'}
try:
    response = requests.post('http://localhost:8000/api/process-audio', files=files, data=data)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
