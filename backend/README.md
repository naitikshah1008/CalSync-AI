
# Backend Service (Go)

This service handles:
- Google OAuth2 authentication
- Google Calendar read/write
- MCP (Model Context Protocol) tools for AI agents

## Responsibilities
- Save credentials.json
- Exchange OAuth code -> token.json
- Refresh tokens automatically
- Expose calendar tools via /mcp

## Key Endpoints
- POST /api/v1/calendar/google-calendar
- GET  /api/v1/calendar/auth-url
- GET  /api/v1/calendar/events
- POST /api/v1/calendar/events/create
- POST /mcp

## Data Directory
backend/data/
- credentials.json
- token.json

## Notes
- OAuth client **must be Web Application**
- Redirect URI must match backend callback

