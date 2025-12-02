package endpoints

import (
	"context"
	"encoding/json"
	"net/http"

	"google.golang.org/api/calendar/v3"
)

// Payload to create event
type CreateEventPayload struct {
	Summary     string `json:"summary"`
	Description string `json:"description"`
	Start       string `json:"start"` // RFC3339 format
	End         string `json:"end"`   // RFC3339 format
}

// POST /api/v1/calendar/events
func GoogleCreateEventHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	// Handle OPTIONS
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only POST allowed
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse JSON
	var payload CreateEventPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	if payload.Summary == "" || payload.Start == "" || payload.End == "" {
		http.Error(w, "summary, start, and end are required", http.StatusBadRequest)
		return
	}

	// Get calendar client
	ctx := context.Background()
	srv, err := getCalendarService(ctx)
	if err != nil {
		http.Error(w, "Failed to init Google Calendar: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Build event
	event := &calendar.Event{
		Summary:     payload.Summary,
		Description: payload.Description,
		Start: &calendar.EventDateTime{
			DateTime: payload.Start,
			TimeZone: "America/Los_Angeles", // adjust if needed
		},
		End: &calendar.EventDateTime{
			DateTime: payload.End,
			TimeZone: "America/Los_Angeles",
		},
	}

	// Insert event
	created, err := srv.Events.Insert("primary", event).Do()
	if err != nil {
		http.Error(w, "Failed to create event: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Success response
	resp := map[string]any{
		"status":   "event_created",
		"event_id": created.Id,
		"htmlLink": created.HtmlLink,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
