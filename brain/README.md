# Brain Service (FastAPI)

The Brain service is the AI orchestration layer for CalSync AI.

It is responsible for generating structured learning plans and schedules using a local LLM running through Ollama, then post-processing the outputs into predictable JSON responses for the backend.

---

## Responsibilities

- Generate AI-based learning plans from user goals
- Generate schedules from learning plans and user preferences
- Parse and validate LLM JSON output
- Post-process schedule results deterministically
- Cache repeated learning plan requests for consistency
- Expose lightweight internal AI endpoints for the backend

---

## LLM Setup

- Model: `llama3.2:3b`
- Runtime: Ollama
- Execution: Local

---

## Key Endpoints

- GET  /health
- POST /test-llm
- POST /ai/generate-learning-plan
- POST /ai/generate-schedule

---

## How It Fits in the System

- The **frontend** never talks to the brain service directly
- The **backend** sends requests to the brain service
- The brain service returns structured JSON
- The backend handles authentication, persistence, and Google Calendar integration

---

## Design Philosophy

- LLM generates the initial structure
- Python validates and normalizes the output
- Backend handles execution and external integrations
