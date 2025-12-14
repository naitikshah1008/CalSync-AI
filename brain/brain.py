from fastapi import FastAPI
import requests
import json
from pydantic import BaseModel

app = FastAPI()

# -------------------------
# CONFIG
# -------------------------

OLLAMA_URL = "http://calsync-ollama:11434/api/generate"
MCP_URL = "http://calsync-backend:8080/mcp"
MODEL_NAME = "llama3.2:3b"


# -------------------------
# BASIC HEALTHCHECK
# -------------------------

@app.get("/health")
def health():
    return {"status": "brain container running"}


# -------------------------
# BASIC LLM TEST ENDPOINT
# -------------------------

class LLMRequest(BaseModel):
    prompt: str

class LearningPlanRequest(BaseModel):
    goal: str
    total_hours: int | None = 10  # default plan size

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


# ============================================================
#                    MCP CLIENT FUNCTIONS
# ============================================================

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
    """
    Call Ollama and return the final JSON object from its response.
    """
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False
    }

    r = requests.post(OLLAMA_URL, json=payload, timeout=120)
    r.raise_for_status()

    raw = r.text.strip()
    last_line = raw.split("\n")[-1]
    data = json.loads(last_line)

    text = data.get("response", "").strip()
    return json.loads(text)



# ============================================================
#                    MCP TEST ENDPOINTS
# ============================================================

@app.get("/mcp/test-list")
def test_list():
    """Call list_calendar_events through MCP"""
    return mcp_call("list_calendar_events", {})


@app.post("/mcp/test-create")
def test_create(req: dict):
    """Call create_calendar_event through MCP"""
    return mcp_call("create_calendar_event", req)


# ============================================================
#                    AGENT TEST ENDPOINT
# ============================================================

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
