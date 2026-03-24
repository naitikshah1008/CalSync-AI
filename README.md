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
```

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

- **Frontend:** HTML, Vanilla JS  
- **Backend:** Go (net/http)  
- **AI Layer:** FastAPI (Python)  
- **LLM Runtime:** Ollama (`llama3.2:3b`)  
- **Integration:** Google Calendar API  
- **Infra:** Docker + Docker Compose  

---

## 📁 Project Structure

```text
CalSync-AI/
├── backend/        # Go API (OAuth + Calendar + MCP)
├── brain/          # FastAPI AI engine
├── frontend/       # UI (HTML + JS)
├── docker-compose.yml
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Docker  
- Docker Compose  
- Google Account  
- Ollama-compatible environment  

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/CalSync-AI.git
cd CalSync-AI
```
### 2. Start the Application

```bash
docker compose up --build
```
### 3. Access the App

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:8000 |
| Backend  | http://localhost:8080 |
| Brain    | http://localhost:5005 |
| Ollama   | http://localhost:11434 |

---

## 🤖 AI Workflow

### 1. Generate Learning Plan

```http
POST /ai/generate-learning-plan
```

**Input:**

- Learning goal  
- Estimated total hours  

**Output:**

- Structured JSON learning plan

  
### 2. Generate Schedule

| Field        | Value |
|-------------|------|
| Endpoint    | `POST /ai/generate-schedule` |
| Constraints | No past dates, no conflicts, one session/day, respects time window |

### 3. Apply Schedule

**Endpoint:** `POST /ai/apply-schedule`

Creates real Google Calendar events from the generated schedule.

---

## 🔗 Google Calendar Integration

**Current Status:** Moving toward app-owned multi-user OAuth  

---

### 🔐 Planned OAuth Flow

1. User clicks **Sign in with Google**  
2. Backend redirects to **Google OAuth**  
3. Google returns callback to backend  
4. Backend creates user session  
5. Calendar actions run on behalf of the user

---

## ⚠️ Current Limitations

- Local/dev-oriented setup  
- Production deployment in progress  
- Depends on local Ollama availability  
- Multi-user support still improving

---

## 🧪 Debugging

### 📄 View Logs

```bash
docker logs -f calsync-backend
docker logs -f calsync-brain
docker logs -f calsync-frontend
docker logs -f calsync-ollama
```
### Test Backend

```bash
curl http://localhost:8080/api/v1/calendar/events
docker logs -f calsync-ollama
```
### Test Brain
```bash
curl http://localhost:5005/health
```

---

## 🧠 Roadmap

### 🔐 Authentication & Scaling

- [ ] Full multi-user Google OAuth  
- [ ] Persistent database-backed user/session storage  
- [ ] Secure production session handling  

---

### 🤖 AI Improvements

- [ ] Better JSON parsing reliability  
- [ ] Multi-week scheduling  
- [ ] Adaptive scheduling  
- [ ] Improved fallback logic  

---

### 🚀 Product Expansion

- [ ] Gmail integration  
- [ ] Notes & documents  
- [ ] Task management  
- [ ] Full productivity assistant  

---

### 🌐 Deployment

- [ ] HTTPS (SSL)  
- [ ] Reverse proxy  
- [ ] Production configs  
- [ ] Background jobs

---

## 🧠 Model Strategy

**Current Model:**
- llama3.2:3b (Ollama)

**Future:**
- Stronger local models  
- Tool-using agents  
- Retrieval over user data  
- Fine-tuning / adapters

---

## 📜 License

MIT License  

---

## 🙌 Acknowledgements

- Ollama  
- Google Calendar API  
- FastAPI  
- Docker

---

## 💡 Vision

CalSync AI is evolving into a full personal AI system for:

- Planning  
- Scheduling  
- Calendar automation  
- Workflow assistance  
- Intelligent task execution  
