# Frontend (Planner UI)

Simple HTML + JavaScript frontend for CalSync-AI.

## User Flow
1. Enter learning goal
2. Generate learning plan
3. Generate schedule
4. Approve & apply to Google Calendar

## API Dependencies
- Brain: http://localhost:5005
- Backend: http://localhost:8080

## Notes
- Frontend does not talk to Google directly
- All calendar writes happen via Brain → MCP → Backend
