import os, json
import sqlite3
from dotenv import load_dotenv
load_dotenv()

from agents.meeting_analyzer import meeting_analyzer_node

db_path = os.path.join('data', 'meetmind.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute('SELECT transcript, mom_data_json, labelled_transcript, transcript_segments_json FROM meetings ORDER BY created_at DESC LIMIT 1')
row = c.fetchone()

if row:
    transcript = row[0]
    
    state = {
        "transcript": transcript,
        "club_name": "AI & ML Club",
        "meeting_date": "2026-09-15"
    }
    
    print("Testing Meeting Analyzer Node...")
    result = meeting_analyzer_node(state)
    
    analysis = result.get("analysis", {})
    err = result.get("error_message")
    
    print(f"\nAnalysis keys: {list(analysis.keys()) if isinstance(analysis, dict) else type(analysis)}")
    if err:
        print(f"Error: {err}")
        
    print(f"Summary: {analysis.get('executive_summary', 'MISSING') if isinstance(analysis, dict) else 'N/A'}")
else:
    print("No meeting found.")
