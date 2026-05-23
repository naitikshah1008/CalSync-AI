# Backend Service (Go)

The backend service powers authentication, data storage, calendar integration, and API orchestration for CalSync AI.

It acts as the central layer between the frontend, AI brain service, database, and Google Calendar.

---

## 🚀 Responsibilities

- Google OAuth2 authentication (multi-user)
- Secure session management
- Google Calendar read/write operations
- Learning plan and schedule persistence
- Schedule application and event syncing
- MCP (Model Context Protocol) tool execution
- API layer for frontend and AI services

---

## 🔗 Key Endpoints

### 🔐 Authentication
- GET  /auth/google/login
- GET  /auth/google/callback
- GET  /auth/me
- POST /auth/logout

---

### 🧠 AI (Planning & Scheduling)
- POST /api/v1/ai/generate-learning-plan  
- POST /api/v1/ai/generate-schedule  
- POST /api/v1/ai/apply-schedule  

---

### 💾 Persistence
- POST /api/v1/ai/save-learning-plan  
- POST /api/v1/ai/save-schedule  
- GET  /api/v1/ai/learning-plans  
- GET  /api/v1/ai/schedules  
- GET  /api/v1/ai/schedule-events  

---

### ✏️ Updates & Deletion
- POST   /api/v1/ai/learning-plans/update
- PUT    /api/v1/ai/schedules/update  
- DELETE /api/v1/ai/learning-plans/delete  
- DELETE /api/v1/ai/schedules/delete  

---

### 📅 Calendar
- GET  /api/v1/calendar/events  
- POST /api/v1/calendar/events/create  

---

### ⚙️ MCP (AI Tool Interface)
- POST /mcp  

---

## 🗄️ Database

Uses PostgreSQL for persistent storage:

- users  
- google_tokens  
- sessions  
- learning_plans  
- schedules  
- schedule_events  

---

## 🔄 MCP (Model Context Protocol)

The backend exposes tools that allow the AI (brain service) to perform real-world actions:

- List calendar events  
- Create calendar events  

This enables the AI to move beyond text generation and interact with external systems.

---

## 🔐 Authentication

- Uses Google OAuth2 (Web Application)
- Stores tokens securely in the database
- Automatically refreshes access tokens
- Maintains user sessions via cookies

---

## ⚠️ Notes

- Backend must be running for frontend to function
- Google OAuth redirect URI must match backend configuration
- All calendar operations are executed via the backend
- No direct communication between frontend and Google APIs
