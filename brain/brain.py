from fastapi import FastAPI
import requests
import json
import hashlib
import re
from pydantic import BaseModel
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://calsync-ollama:11434/api/generate"
MODEL_NAME = "llama3.2:3b"
LEARNING_PLAN_CACHE = {}

@app.get("/health")
def health(): return {"status": "brain container running"}

class LLMRequest(BaseModel): prompt: str

class LearningPlanRequest(BaseModel):
    goal: str
    total_hours: int | None = 10

class Preferences(BaseModel):
    start_hour: int
    end_hour: int
    session_length_minutes: int
    days_per_week: int
    day_type: str = "both"

class ScheduleRequest(BaseModel):
    learning_plan: list
    preferences: Preferences
    calendar_events: list

class GenerateLearningPlanRequest(BaseModel):
    goal: str
    total_hours: int

def _ollama_generate_json(prompt: str) -> dict:
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0,
            "seed": 42,
            "top_p": 0.9,
            "num_predict": 1200
        }
    }
    r = requests.post(OLLAMA_URL, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    response_text = data.get("response", "").strip()
    start = response_text.find("{")
    end = response_text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise json.JSONDecodeError("No JSON object found in model response", response_text, 0)
    json_text = response_text[start:end + 1]
    return json.loads(json_text)

def normalize_goal(goal: str) -> str:
    goal = goal.strip().lower()
    goal = re.sub(r"\s+", " ", goal)
    return goal

def learning_plan_cache_key(goal: str, total_hours: int | None) -> str:
    normalized = f"{normalize_goal(goal)}::{total_hours or 10}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

def _normalize_events(events: list) -> list:
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


def postprocess_schedule(schedule: list, learning_plan: list, preferences) -> list:
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
        allowed = topic_subtopics.get(topic, set())
        filtered_subtopics = [
            st for st in s.get("subtopics", [])
            if st in allowed and st not in seen_subtopics[topic]
        ]
        if not filtered_subtopics: continue
        seen_subtopics[topic].update(filtered_subtopics)
        session_counters[topic] += 1
        session_number = session_counters[topic]
        start_dt = datetime.fromisoformat(s["start"])
        max_end = start_dt.replace(
            hour=preferences.end_hour,
            minute=0,
            second=0,
            microsecond=0
        )
        desired_end = start_dt + timedelta(
            minutes=preferences.session_length_minutes
        )
        end_dt = min(desired_end, max_end)
        if end_dt <= start_dt: continue
        day_key = start_dt.date().isoformat()
        if day_key in used_days: continue
        used_days.add(day_key)
        cleaned.append({
            "topic": topic,
            "session_number": session_number,
            "subtopics": filtered_subtopics,
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat()
        })
    return cleaned

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
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/ai/generate-learning-plan")
def generate_learning_plan(req: LearningPlanRequest):
    if not req.goal.strip():
        return {"error": "goal is required"}
    cache_key = learning_plan_cache_key(req.goal, req.total_hours)
    if cache_key in LEARNING_PLAN_CACHE:
        return {
            **LEARNING_PLAN_CACHE[cache_key],
            "source": "cache"
        }
    prompt = f"""
        You are an expert learning coach.

        Return ONLY valid JSON.
        Do not return markdown.
        Do not return explanation text.
        Do not return extra keys.

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

        Rules:
        - Goal: {req.goal}
        - Target total hours: {req.total_hours}
        - Generate 8 topics exactly
        - Topics must be ordered from beginner to advanced
        - Avoid unnecessary variation
        - For the same goal, return a very similar structure every time
        - difficulty_rating must be exactly one of: easy, medium, hard
        - estimated_hours must be realistic and consistent
        - Every topic must have 3 to 5 subtopics
        - Keep topic names concise and practical
        """
    try:
        plan = _ollama_generate_json(prompt)
        LEARNING_PLAN_CACHE[cache_key] = plan
        return {
            **plan,
            "source": "llm"
        }
    except json.JSONDecodeError as e:
        return {"error": "Failed to parse model JSON", "details": str(e)}
    except Exception as e:
        return {"error": str(e)}

@app.post("/ai/generate-schedule")
def generate_schedule(req: ScheduleRequest):
    prefs = req.preferences
    calendar_events = _normalize_events(req.calendar_events)
    today = datetime.now().date().isoformat()
    prompt = f"""
    You are an AI scheduling assistant.
    CRITICAL RULES (MUST FOLLOW):
    - ALL scheduled sessions MUST start on or AFTER this date: {today}
    - DO NOT schedule anything in the past
    Return ONLY valid JSON. No markdown. No explanation.
    Learning Plan:
    {req.learning_plan}
    Existing Calendar Events:
    {calendar_events}
    User Preferences:
    - Daily time window: {prefs.start_hour}:00 to {prefs.end_hour}:00
    - Session length: {prefs.session_length_minutes} minutes
    - Study days per week: {prefs.days_per_week}
    Rules:
    - One session per day
    - Do not overlap calendar events
    - Complete one topic before moving to the next
    - Restart session_number per topic
    OUTPUT SCHEMA:
    {{
      "schedule": [
        {{
          "topic": "string",
          "session_number": number,
          "subtopics": ["string"],
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
    except json.JSONDecodeError as e: return {"error": "Failed to parse schedule JSON", "details": str(e)}
    except Exception as e: return {"error": "Unexpected error", "details": str(e)}
