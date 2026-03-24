# Frontend (Planner UI)

Frontend interface for **CalSync AI**, built with simple HTML, CSS, and Vanilla JavaScript.

It allows users to create learning goals, generate AI-powered learning plans, build editable schedules, sync approved sessions to Google Calendar, and manage saved plan/schedule history.

## Responsibilities

- Collect user goals and study preferences
- Display generated learning plans and schedules
- Allow editing, deleting, and adding schedule sessions
- Show upcoming Google Calendar events
- Load saved learning plans, schedules, and applied events
- Send authenticated requests to the backend API

## User Flow

1. Sign in with Google
2. Enter a learning goal
3. Select study days, days per week, and hours per day
4. Generate a learning plan
5. Generate a schedule
6. Edit or extend the generated schedule if needed
7. Save the learning plan and schedule
8. Approve and sync the schedule to Google Calendar
9. View saved history and applied calendar events

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Nginx (for static serving and reverse proxy)

## Backend Integration

The frontend communicates with the backend for:

- Authentication
- Learning plan generation
- Schedule generation
- Saving plans and schedules
- Applying schedules to Google Calendar
- Loading calendar events
- Loading saved history

## Notes

- The frontend does **not** communicate with Google Calendar directly
- The frontend does **not** communicate with Ollama directly
- All protected actions go through the backend API
- The backend coordinates with the brain service and Google Calendar
