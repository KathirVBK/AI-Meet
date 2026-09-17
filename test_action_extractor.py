import os, json, time, re
from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from prompts.extractor_prompt import EXTRACTOR_PROMPT

transcript = """Good morning everyone. Let us start today's meeting. The main agenda is our upcoming technical fest TechVista 2026.
Karthik, please prepare the workshop content and presentation slides by next Friday.
Priya, can you contact the department coordinator and confirm the seminar hall booking by Wednesday?
Aaron will design the event poster and share the first draft in the club group by Monday.
Mina, please create the registration form and collect participant details by Thursday.
We also need someone to arrange refreshments - Ravi, can you handle that?
Let us meet again on September 19th at 3:30 PM."""

analysis = json.dumps({"meeting_title": "TechVista Planning", "decisions": [{"decision": "Event date set to Oct 3", "status": "Confirmed"}]})

llm = ChatGroq(model=os.getenv("GROQ_LLM_MODEL", "qwen/qwen3.8-27b"), api_key=os.getenv("GROQ_API_KEY"), temperature=0.0, max_tokens=8192)
prompt = PromptTemplate(template=EXTRACTOR_PROMPT, input_variables=["transcript", "analysis", "labelled_transcript", "participants", "speaker_mapping"])
chain = prompt | llm | StrOutputParser()

print("Calling LLM...")
response = chain.invoke({
    "transcript": transcript,
    "analysis": analysis,
    "labelled_transcript": "Speaker 1:\n" + transcript,
    "participants": "Speaker 1",
    "speaker_mapping": "  Speaker 1 -> Unknown",
})

# Strip thinking
cleaned = re.sub(r"<think>.*?(?:</think>|\Z)", "", response, flags=re.DOTALL).strip()
print("Raw response length:", len(response))
print("Cleaned response length:", len(cleaned))
print("Cleaned response:")
print(cleaned[:1000])
print()

# Try parsing
try:
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[-1].strip() == "```":
            cleaned = "\n".join(lines[1:-1])
        else:
            cleaned = "\n".join(lines[1:])
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start >= 0 and end > start:
        arr = json.loads(cleaned[start:end+1])
        print("Parsed", len(arr), "action items")
        for ai in arr[:5]:
            print("  -", ai.get("task","")[:80], "|", ai.get("owner",""))
    else:
        print("No JSON array found in response")
except Exception as e:
    print("Parse error:", e)
