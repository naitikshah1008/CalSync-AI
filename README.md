# 🚀 CalSync AI

**AI-Powered Smart Scheduling & Productivity Assistant (Local LLM + Google Calendar)**

CalSync AI is a local-first AI productivity system that generates structured learning plans, converts them into optimized schedules, and automatically syncs them with Google Calendar.

It uses a local LLM via Ollama combined with a tool-based architecture (MCP) to create a powerful, extensible personal AI assistant.

---

## ✨ Features

- 🧠 AI-Generated Learning Plans  
- 📅 Smart Schedule Generation (No Conflicts)  
- 🔗 Google Calendar Integration (OAuth2)  
- ⚙️ MCP Tooling (AI → Real Actions)  
- 🐳 Fully Dockerized Setup  
- 🔒 Local LLM (No external AI APIs required)  

---

## 🏗️ Architecture

```text
Frontend (HTML + JS)
        ↓
Brain (FastAPI - AI Orchestration)
        ↓ MCP Calls
Backend (Go API)
        ↓
Google Calendar API
'''

---

## ⚙️ Services Overview

| Service   | Purpose |
|-----------|--------|
| frontend  | UI for user interaction |
| brain     | AI logic (plan + schedule generation) |
| backend   | OAuth, DB, calendar sync, MCP |
| ollama    | Local LLM inference |
| postgres  | Persistent storage |

---

## 🧰 Tech Stack

### Frontend
- HTML
- CSS
- Vanilla JS

### Backend
- Go (net/http)
- PostgreSQL

### AI Layer
- FastAPI (Python)

### LLM Runtime
- Ollama (local models)

### Integration
- Google Calendar API (OAuth2)

### Infrastructure
- Docker + Docker Compose
- Nginx (frontend proxy)

---

🚀 Getting Started
Prerequisites
Docker
Docker Compose
Google Account
Ollama-compatible environment
1. Clone the Repository
git clone https://github.com/your-username/CalSync-AI.git
cd CalSync-AI
2. Start the Application
docker compose up --build
3. Access the App
Service	URL
Frontend	http://localhost:8000

Backend	http://localhost:8080

Brain	http://localhost:5005

Ollama	http://localhost:11434
🤖 AI Workflow
1. Generate Learning Plan
POST /ai/generate-learning-plan

Input:

Learning goal
Estimated total hours

Output:

Structured JSON learning plan
2. Generate Schedule
POST /ai/generate-schedule

Constraints:

No past dates
No calendar conflicts
One session per day
Respects user time window
3. Apply Schedule
POST /ai/apply-schedule

Creates real Google Calendar events from the generated schedule.

🔗 Google Calendar Integration

Current Status: Moving toward app-owned multi-user OAuth

Planned OAuth Flow:

User clicks Sign in with Google
Backend redirects to Google OAuth
Google returns callback
Backend creates session
Calendar actions run on behalf of user
⚠️ Current Limitations
Local/dev-oriented setup
Production deployment in progress
Depends on local Ollama availability
Multi-user support still improving
🧪 Debugging
View Logs
docker logs -f calsync-backend
docker logs -f calsync-brain
docker logs -f calsync-frontend
docker logs -f calsync-ollama
Test Backend
curl http://localhost:8080/api/v1/calendar/events
Test Brain
curl http://localhost:5005/health
🧠 Roadmap
Authentication & Scaling
 Full multi-user Google OAuth
 Persistent database-backed user/session storage
 Secure production session handling
AI Improvements
 Better JSON parsing reliability
 Multi-week scheduling
 Adaptive scheduling
 Improved fallback logic
Product Expansion
 Gmail integration
 Notes & documents
 Task management
 Full productivity assistant
Deployment
 HTTPS (SSL)
 Reverse proxy
 Production configs
 Background jobs
🧠 Model Strategy

Current Model:

llama3.2:3b (Ollama)

Future:

Stronger local models
Tool-using agents
Retrieval over user data
Fine-tuning / adapters
📜 License

MIT License

🙌 Acknowledgements
Ollama
Google Calendar API
FastAPI
Docker
💡 Vision

CalSync AI is evolving into a full personal AI system for:

Planning
Scheduling
Calendar automation
Workflow assistance
Intelligent task execution