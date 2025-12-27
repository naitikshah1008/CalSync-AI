# Brain Service (FastAPI)

The Brain service is the AI orchestration layer.

## Responsibilities
- Generate learning plans using LLM
- Generate schedules with constraints
- Post-process schedules deterministically
- Apply schedules via MCP tools

## LLM
- Model: llama3.2:3b
- Provider: Ollama (local)

## Key Endpoints
- POST /ai/generate-learning-plan
- POST /ai/generate-schedule
- POST /ai/apply-schedule

## MCP Usage
Calls backend MCP tools:
- list_calendar_events
- create_calendar_event

## Design Philosophy
- LLM proposes
- Python enforces rules
- Backend executes safely
