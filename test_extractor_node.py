import os, json
import sqlite3
from dotenv import load_dotenv
load_dotenv()

from graph.workflow import build_workflow
from agents.action_extractor import action_extractor_node

db_path = os.path.join('data', 'meetmind.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute('SELECT transcript, mom_data_json, labelled_transcript, transcript_segments_json FROM meetings ORDER BY created_at DESC LIMIT 1')
row = c.fetchone()

if row:
    transcript = row[0]
    mom = json.loads(row[1]) if row[1] else {}
    labelled_transcript = row[2]
    segments = json.loads(row[3]) if row[3] else []
    
    state = {
        "transcript": transcript,
        "analysis": mom,  # analysis is essentially mom_data
        "labelled_transcript": labelled_transcript,
        "participants": mom.get("participants", []),
        "speaker_mapping": mom.get("speaker_mapping", {}),
        "transcript_segments": segments,
    }
    
    print("Testing Action Extractor Node...")
    result = action_extractor_node(state)
    
    actions = result.get("extracted_action_items", [])
    err = result.get("error_message")
    
    print(f"\nExtracted {len(actions)} actions")
    if err:
        print(f"Error: {err}")
    
    for a in actions:
        print(a)
else:
    print("No meeting found.")
