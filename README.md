CalSync-AI 🗓️🤖

AI-Powered Learning Planner with Google Calendar Integration

CalSync-AI is a local, AI-driven learning planner that generates structured learning plans, converts them into realistic study schedules, and automatically syncs them to Google Calendar — all running locally using Docker.

✨ Features

🧠 LLM-Generated Learning Plans

📅 Automatic Schedule Generation

🔗 Google Calendar Sync (OAuth2)

🛠 Modular MCP (Model Context Protocol) Tooling

🐳 Fully Dockerized (Frontend, Backend, Brain, Ollama)

🔒 Local-only execution (no cloud dependencies)

🏗️ Architecture Overview
Frontend (JS/HTML)
   ↓
Brain Service (FastAPI + LLM orchestration)
   ↓
MCP Calls
   ↓
Backend (Go)
   ↓
Google Calendar API

Services
Service	Purpose
frontend	User UI (learning goal → schedule → approve)
brain	AI logic, prompt orchestration, schedule validation
backend	OAuth, calendar read/write, MCP host
ollama	Local LLM inference engine
🚀 Tech Stack

Frontend: Vanilla JS + HTML

Backend: Go (Google Calendar API)

Brain: FastAPI (Python)

LLM: Ollama (llama3.2:3b)

Auth: Google OAuth2

Infra: Docker + Docker Compose

📂 Repository Structure
CalSync-AI/
├── backend/
│   ├── cmd/api/
│   ├── endpoints/
│   ├── data/               # credentials.json, token.json
│   └── Dockerfile
├── brain/
│   ├── brain.py
│   └── Dockerfile
├── frontend/
│   ├── planner.js
│   └── index.html
├── docker-compose.yml
└── README.md

🔐 Google Calendar Setup
1️⃣ Create Google OAuth Credentials

Go to Google Cloud Console

Create a project

Enable Google Calendar API

Create OAuth Client ID

Application type: Web

Redirect URI:

http://localhost:8080/api/v1/calendar/callback

2️⃣ Configure Credentials in App

From the frontend UI:

Enter:

Client ID

Client Secret

Redirect URI

Credentials are saved to:

backend/data/credentials.json

3️⃣ Authenticate

Click Connect Google Calendar

Complete OAuth flow

Token saved at:

backend/data/token.json

🧠 AI Flow (How It Works)
Step 1 — Generate Learning Plan
POST /ai/generate-learning-plan


Output:

{
  "learning_plan": [
    {
      "topic": "Go Fundamentals",
      "subtopics": ["Variables", "Control Flow"],
      "estimated_hours": 2
    }
  ]
}

Step 2 — Generate Schedule
POST /ai/generate-schedule


Rules enforced:

No past dates

One session per day

No calendar conflicts

User-defined time window

Step 3 — Apply Schedule
POST /ai/apply-schedule


Creates Google Calendar events

Uses MCP tool create_calendar_event

🔧 Running the Project
Prerequisites

Docker

Docker Compose

Google account

Start Everything
docker compose up --build


Services will be available at:

Service	URL
Frontend	http://localhost:8000

Backend	http://localhost:8080

Brain	http://localhost:5005

Ollama	http://localhost:11434
🧪 Debugging Tips
Check Brain Logs
docker logs -f calsync-brain

Check Backend Logs
docker logs -f calsync-backend

Test Calendar Access
curl http://localhost:8080/api/v1/calendar/events

⚠️ Common Pitfalls
Issue	Fix
LLM JSON parse errors	Use r.json() from Ollama
Events not appearing	Verify token.json exists
Past dates generated	Enforced in generate_schedule
Nothing happens on approve	Ensure apply: true
🛣️ Roadmap

 Multi-week schedules

 User timezone detection

 UI calendar preview

 Retry-safe LLM parsing

 Task rescheduling

📜 License

MIT License — use freely, modify responsibly.

🙌 Acknowledgements

Ollama

Google Calendar API

FastAPI

Docker