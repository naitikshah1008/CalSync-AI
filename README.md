# CalSync-AI 🗓️🤖

**AI-Powered Learning Planner with Google Calendar Integration**

CalSync-AI is a local, AI-driven learning planner that generates structured learning plans, converts them into realistic study schedules, and automatically syncs them to **Google Calendar**, all running locally using Docker.

---

## ✨ Features

* 🧠 **LLM-Generated Learning Plans**
* 📅 **Automatic Schedule Generation**
* 🔗 **Google Calendar Sync (OAuth2)**
* 🛠 **MCP (Model Context Protocol) Tooling**
* 🐳 **Fully Dockerized Stack**
* 🔒 **Local-only Execution (No Cloud LLMs)**

---

## 🏗️ Architecture Overview

```
Frontend (HTML + JS)
   ↓
Brain Service (FastAPI + LLM Orchestration)
   ↓  MCP Calls
Backend (Go API)
   ↓
Google Calendar API
```

### Services

| Service  | Purpose                                |
| -------- | -------------------------------------- |
| frontend | User interface for planning & approval |
| brain    | AI logic, scheduling, validation       |
| backend  | OAuth, calendar read/write, MCP host   |
| ollama   | Local LLM inference engine             |

---

## 🚀 Tech Stack

* **Frontend**: HTML + Vanilla JavaScript
* **Backend**: Go (Google Calendar API)
* **Brain**: FastAPI (Python)
* **LLM**: Ollama (`llama3.2:3b`)
* **Auth**: Google OAuth2
* **Infra**: Docker + Docker Compose

---

## 📂 Repository Structure

```
CalSync-AI/
├── backend
│   ├── bin
│   │   └── api
│   ├── cmd
│   │   └── api
│   │       └── main.go
│   ├── data
│   │   ├── credentials.json
│   │   └── token.json
│   ├── Dockerfile
│   ├── endpoints
│   │   ├── calendar_create_event.go
│   │   ├── calendar_events.go
│   │   ├── calender.go
│   │   ├── google_oauth.go
│   │   └── mcp.go
│   ├── go.mod
│   ├── go.sum
│   ├── internal
│   │   └── logging.go
│   ├── logs
│   │   └── requests_log.csv
│   └── README.md
├── brain
│   ├── brain.py
│   ├── Dockerfile
│   ├── README.md
│   └── requirements.txt
├── docker-compose.yml
├── frontend
│   ├── app.js
│   ├── Dockerfile
│   ├── google-connect.html
│   ├── index.html
│   ├── main.html
│   ├── main.js
│   ├── planner.js
│   └── README.md
├── logs
└── README.md
```

---

## 🔐 Google Calendar Setup

### 1️⃣ Create OAuth Credentials

1. Go to **Google Cloud Console**
2. Create a new project
3. Enable **Google Calendar API**
4. Create **OAuth Client ID**

   * Application type: Web
   * Redirect URI:

     ```
     http://localhost:8080/api/v1/calendar/callback
     ```

---

### 2️⃣ Configure Credentials

From the frontend UI, submit:

* Client ID
* Client Secret
* Redirect URI

Saved automatically to:

```
backend/data/credentials.json
```

---

### 3️⃣ Authenticate

* Click **Connect Google Calendar**
* Complete OAuth flow
* Token saved to:

```
backend/data/token.json
```

---

## 🧠 AI Workflow

### Step 1 — Generate Learning Plan

```
POST /ai/generate-learning-plan
```

Produces structured JSON learning plan.

---

### Step 2 — Generate Schedule

```
POST /ai/generate-schedule
```

Constraints enforced:

* No past dates
* One session per day
* No calendar overlaps
* User-defined time window

---

### Step 3 — Apply Schedule

```
POST /ai/apply-schedule
```

Creates Google Calendar events using MCP tooling.

---

## 🔧 Running the Project

### Prerequisites

* Docker
* Docker Compose
* Google account

---

### Start Services

```bash
docker compose up --build
```

---

### Service URLs

| Service  | URL                                              |
| -------- | ------------------------------------------------ |
| Frontend | [http://localhost:8000](http://localhost:8000)   |
| Backend  | [http://localhost:8080](http://localhost:8080)   |
| Brain    | [http://localhost:5005](http://localhost:5005)   |
| Ollama   | [http://localhost:11434](http://localhost:11434) |

---

## 🧪 Debugging

### Brain Logs

```bash
docker logs -f calsync-brain
```

### Backend Logs

```bash
docker logs -f calsync-backend
```

### Test Calendar API

```bash
curl http://localhost:8080/api/v1/calendar/events
```

---

## ⚠️ Common Issues

| Issue                 | Solution                      |
| --------------------- | ----------------------------- |
| LLM JSON parse errors | Use strict JSON extraction    |
| Events not appearing  | Verify token.json exists      |
| Past dates scheduled  | Enforced in generate_schedule |
| Approve does nothing  | Ensure `apply: true`          |

---

## 🛣️ Roadmap

* [ ] Multi-week scheduling
* [ ] Timezone auto-detection
* [ ] Calendar preview UI
* [ ] Retry-safe LLM parsing
* [ ] Rescheduling support

---

## 📜 License

MIT License

---

## 🙌 Acknowledgements

* Ollama
* Google Calendar API
* FastAPI
* Docker
