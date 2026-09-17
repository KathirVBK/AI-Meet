"""Prompt template for the Meeting Analyzer agent."""

ANALYZER_PROMPT = """
You are an expert meeting analyst for student clubs and organizations.

Your task is to carefully analyze the following meeting transcript and extract structured information.

TRANSCRIPT:
{transcript}

CLUB NAME: {club_name}
MEETING DATE: {meeting_date}

Please provide a comprehensive analysis in the following strict JSON format. 
Return ONLY the JSON object, with no markdown formatting outside of it, no code fences, and no conversational text.

{{
  "meeting_title": "Descriptive title for the meeting",
  "date": "Date of the meeting",
  "attendees": ["List", "of", "attendees"],
  "agenda": ["Topic 1", "Topic 2"],
  "discussion_points": ["Key discussion point 1", "Key discussion point 2"],
  "decisions": [
    {{
      "decision": "Decision 1",
      "status": "Confirmed",
      "evidence": "Optional transcript snippet"
    }}
  ],
  "executive_summary": "A concise 2-4 sentence summary of the meeting covering what was discussed, key outcomes, and next steps.",
  "next_meeting": "Date/time/location of the next meeting if mentioned, or 'Not mentioned'"
}}

Be thorough, accurate, and ensure every important detail from the transcript is captured in the JSON.
"""
