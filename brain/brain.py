from fastapi import FastAPI
import requests
import json
from pydantic import BaseModel
from datetime import datetime, timedelta
from collections import defaultdict
from copy import deepcopy
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # OK for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CONFIG
OLLAMA_URL = "http://calsync-ollama:11434/api/generate"
MCP_URL = "http://calsync-backend:8080/mcp"
MODEL_NAME = "llama3.2:3b"

# BASIC HEALTHCHECK
@app.get("/health")
def health():
    return {"status": "brain container running"}

# BASIC LLM TEST ENDPOINT
class LLMRequest(BaseModel):
    prompt: str

class LearningPlanRequest(BaseModel):
    goal: str
    total_hours: int | None = 10  # default plan size

class Preferences(BaseModel):
    start_hour: int          # e.g. 18
    end_hour: int            # e.g. 22
    session_length_minutes: int  # e.g. 90
    days_per_week: int       # e.g. 4

class ScheduleRequest(BaseModel):
    learning_plan: list
    preferences: Preferences

class ApplyScheduleRequest(BaseModel):
    schedule: list
    apply: bool = False

class GenerateLearningPlanRequest(BaseModel):
    goal: str
    total_hours: int

@app.post("/test-llm")
def test_llm(req: LLMRequest):
    payload = {
        "model": MODEL_NAME,
        "prompt": req.prompt
    }
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        return {
            "status": "ok",
            "response": data.get("response", "")
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# MCP CLIENT FUNCTIONS
def mcp_call(tool: str, args: dict):
    """
    Minimal JSON-over-HTTP MCP client.
    Sends a tool request to backend's /mcp endpoint.
    """
    payload = {
        "tool": tool,
        "args": args or {}
    }
    try:
        r = requests.post(MCP_URL, json=payload, timeout=30)
        r.raise_for_status()
        data = r.json()
        # backend returns { error: "..."} on failure
        if data.get("error"):
            return {"error": data["error"]}
        return {"result": data.get("result")}
    except Exception as e:
        return {"error": str(e)}
    
def _ollama_generate_json(prompt: str) -> dict:
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False
    }
    r = requests.post(OLLAMA_URL, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    response_text = data.get("response", "").strip()
    start = response_text.find("{")
    end = response_text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise json.JSONDecodeError(
            "No JSON object found in model response",
            response_text,
            0
        )
    json_text = response_text[start:end + 1]
    return json.loads(json_text)

def _normalize_events(events: list) -> list:
    """
    Normalize calendar events into a minimal, LLM-friendly format.
    """
    normalized = []
    for e in events:
        start = e.get("start")
        end = e.get("end")
        if not start or not end:
            continue
        normalized.append({
            "summary": e.get("summary", "No title"),
            "start": start,
            "end": end
        })
    return normalized

def postprocess_schedule(
    schedule: list,
    learning_plan: list,
    preferences
) -> list:
    """
    Deterministically enforce scheduling constraints.
    """
    # Build topic → allowed subtopics map
    topic_subtopics = {
        item["topic"]: set(item.get("subtopics", []))
        for item in learning_plan
    }
    cleaned = []
    seen_subtopics = defaultdict(set)
    session_counters = defaultdict(int)
    used_days = set() 
    for s in schedule:
        topic = s["topic"]
        # 1. Filter subtopics to correct topic 
        allowed = topic_subtopics.get(topic, set())
        filtered_subtopics = [
            st for st in s.get("subtopics", [])
            if st in allowed and st not in seen_subtopics[topic]
        ]
        if not filtered_subtopics:
            continue  # drop empty/invalid session
        seen_subtopics[topic].update(filtered_subtopics)
        # 2. Fix session numbering (per topic)
        session_counters[topic] += 1
        session_number = session_counters[topic]
        # 3. Enforce time window + duration
        start_dt = datetime.fromisoformat(s["start"])
        max_end = start_dt.replace(
            hour=preferences.end_hour,
            minute=0,
            second=0
        )
        desired_end = start_dt + timedelta(
            minutes=preferences.session_length_minutes
        )
        end_dt = min(desired_end, max_end)
        if end_dt <= start_dt:
            continue
        day_key = start_dt.date().isoformat()
        if day_key in used_days:
            continue
        used_days.add(day_key)
        cleaned.append({
            "topic": topic,
            "session_number": session_number,
            "subtopics": filtered_subtopics,
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat()
        })
    return cleaned

# MCP TEST ENDPOINTS
@app.get("/mcp/test-list")
def test_list():
    """Call list_calendar_events through MCP"""
    return mcp_call("list_calendar_events", {})

@app.post("/mcp/test-create")
def test_create(req: dict):
    """Call create_calendar_event through MCP"""
    return mcp_call("create_calendar_event", req)

# AGENT TEST ENDPOINT
@app.post("/ai/test-agent")
def test_agent(req: dict):
    """
    LLM retrieves calendar via MCP,
    then writes a natural language summary of the schedule.
    """
    user_prompt = req.get("prompt", "Describe my upcoming schedule.")
    # STEP 1: Fetch events using MCP
    events = mcp_call("list_calendar_events", {})
    if "error" in events:
        return {"error": "MCP error: " + events["error"]}
    # STEP 2: Build combined system prompt
    full_prompt = f"""
    You are a local AI agent with access to the user's calendar tools.
    User request:
    {user_prompt}
    Calendar events (raw JSON data):
    {events['result']}
    Explain the user's upcoming schedule clearly in one short paragraph.
    """
    llm_payload = {
        "model": MODEL_NAME,
        "prompt": full_prompt
    }
    # STEP 3: Call the local LLM
    try:
        r = requests.post(OLLAMA_URL, json=llm_payload, timeout=60)
        raw = r.text.strip()
        # Ollama may produce multiple JSON chunks; keep only the last valid JSON
        last_line = raw.split("\n")[-1]
        response_data = json.loads(last_line)
        return {"events": events["result"],"llm_response": response_data.get("response", "")}
    except json.JSONDecodeError:
        return {"error": "Failed to parse Ollama response","raw": raw}
    except Exception as e:
        return {"error": "LLM error: " + str(e)}
    
@app.post("/ai/generate-learning-plan")
def generate_learning_plan(req: LearningPlanRequest):
    if not req.goal.strip():
        return {"error": "goal is required"}
    prompt = f"""
    You are an expert learning coach.
    Return ONLY valid JSON. No markdown. No explanation text.
    Schema:
    {{
    "learning_plan": [
        {{
        "topic": "string",
        "description": "string",
        "subtopics": ["string", "string"],
        "estimated_hours": number,
        "difficulty_rating": "easy" | "medium" | "hard"
        }}
    ],
    "total_estimated_hours": number
    }}
    Constraints:
    - Goal: {req.goal}
    - Target total hours (approx): {req.total_hours}
    - Use 6 to 12 topics
    - difficulty_rating must be exactly: easy, medium, or hard
    """
    try:
        plan = _ollama_generate_json(prompt)
        return plan
    except json.JSONDecodeError as e:
        return {"error": "Failed to parse model JSON", "details": str(e)}
    except Exception as e:
        return {"error": str(e)}

@app.post("/ai/generate-schedule")
def generate_schedule(req: ScheduleRequest):
    prefs = req.preferences
    # STEP 1: Fetch calendar events via MCP
    events_resp = mcp_call("list_calendar_events", {})
    if "error" in events_resp:
        return {"error": "Failed to fetch calendar events", "details": events_resp["error"]}
    calendar_events = _normalize_events(events_resp.get("result", []))
    # STEP 2: Build scheduling prompt
    prompt = f"""
    You are an AI scheduling assistant.
    Your task is to create a realistic study schedule.
    Return ONLY valid JSON. No markdown. No explanation.
    INPUT DATA:
    Learning Plan:
    {req.learning_plan}
    Existing Calendar Events:
    {calendar_events}
    User Preferences:
    - Allowed days: weekdays AND weekends
    - Daily time window: {prefs.start_hour}:00 to {prefs.end_hour}:00
    - Session length: {prefs.session_length_minutes} minutes
    - Study days per week: {prefs.days_per_week}
    SESSION PLANNING RULES:
    - Group subtopics into study sessions in a logical learning order
    - A session may include multiple subtopics
    - Do NOT repeat subtopics across sessions for the same topic
    - Complete one topic fully before moving to the next
    - Restart session_number at 1 for each topic
    TIME PLACEMENT RULES:
    - Schedule at most one session per day
    - Respect the provided daily time window
    - Sessions must not overlap calendar events
    IMPORTANT:
    - Do NOT try to stretch or shrink sessions to match time exactly
    - Focus only on logical grouping and ordering

    OUTPUT SCHEMA:
    {{
    "schedule": [
        {{
        "topic": "string",
        "session_number": number,
        "subtopics": ["string", "string"],
        "start": "YYYY-MM-DDTHH:MM:SS±HH:MM",
        "end": "YYYY-MM-DDTHH:MM:SS±HH:MM"
        }}
    ]
    }}
    """
    try:
        raw_schedule = _ollama_generate_json(prompt)
        validated = postprocess_schedule(
            schedule=raw_schedule.get("schedule", []),
            learning_plan=req.learning_plan,
            preferences=prefs
        )
        return {"schedule": validated}
    except json.JSONDecodeError as e:
        return {"error": "Failed to parse schedule JSON", "details": str(e)}
    except Exception as e:
        return {"error": "Unexpected error", "details": str(e)}

@app.post("/ai/apply-schedule")
def apply_schedule(req: ApplyScheduleRequest):
    preview_events = []
    for session in req.schedule:
        title = (
            f"{session['topic']} "
            f"(Session {session['session_number']}): "
            f"{', '.join(session['subtopics'])}"
        )
        description = (
            "Learning session generated by CalSync AI\n\n"
            f"Topic: {session['topic']}\n"
            f"Session: {session['session_number']}\n"
            f"Subtopics: {', '.join(session['subtopics'])}"
        )
        event_payload = {
            "summary": title,
            "description": description,
            "start": session["start"],
            "end": session["end"]
        }
        # Always collect preview info
        preview_events.append({
            "title": title,
            "start": session["start"],
            "end": session["end"]
        })
        if not req.apply:
            continue
        result = mcp_call("create_calendar_event", event_payload)
        if "error" in result:
            return {
                "error": "Failed to create calendar event",
                "details": result["error"],
                "failed_event": event_payload
            }
    if not req.apply:
        return {
            "mode": "dry-run",
            "would_create": preview_events
        }
    return {
        "mode": "applied",
        "events_created": preview_events
    }