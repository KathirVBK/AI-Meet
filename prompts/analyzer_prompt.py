"""Prompt template for the Meeting Analyzer agent."""

ANALYZER_PROMPT = """
You are an expert meeting analyst for student clubs and organizations.

Your task is to carefully analyze the following meeting transcript and extract structured information.

TRANSCRIPT:
{transcript}

CLUB NAME: {club_name}
MEETING DATE: {meeting_date}

Please provide a comprehensive analysis in the following structured format:

## MEETING OVERVIEW
- **Title**: [Descriptive title for the meeting]
- **Venue/Platform**: [Where the meeting took place, if mentioned]
- **Attendees**: [Comma-separated list of all people mentioned or identified]
- **Duration**: [Estimated or stated duration, if available]

## AGENDA ITEMS
List all topics that were formally or informally discussed (numbered list):
1. [Topic 1]
2. [Topic 2]
...

## KEY DISCUSSIONS
Summarize the main discussion points clearly:
- [Discussion point 1]
- [Discussion point 2]
...

## DECISIONS MADE
List all decisions, resolutions, or agreements that were reached:
- [Decision 1]
- [Decision 2]
...

## NEXT MEETING
[Details about the next meeting if mentioned, otherwise "Not mentioned"]

## EXECUTIVE SUMMARY
Write a concise 3-5 sentence summary of the overall meeting, its purpose, and outcomes.

Be thorough, accurate, and ensure every important detail from the transcript is captured.
"""
