package endpoints

import (
	"net/http"

	"encoding/json"

	"google.golang.org/api/calendar/v3"
)

type CreateEventPayload struct {
	Summary     string `json:"summary"`
	Description string `json:"description"`
	Start       string `json:"start"`
	End         string `json:"end"`
}

func GoogleCreateEventHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	user, err := currentUserFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var payload CreateEventPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if payload.Summary == "" || payload.Start == "" || payload.End == "" {
		http.Error(w, "summary, start, and end are required", http.StatusBadRequest)
		return
	}
	srv, err := getCalendarServiceForUser(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "failed to init Google Calendar: "+err.Error(), http.StatusInternalServerError)
		return
	}
	event := &calendar.Event{
		Summary:     payload.Summary,
		Description: payload.Description,
		Start: &calendar.EventDateTime{
			DateTime: payload.Start,
		},
		End: &calendar.EventDateTime{
			DateTime: payload.End,
		},
	}
	created, err := srv.Events.Insert("primary", event).Do()
	if err != nil {
		http.Error(w, "failed to create event: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "event_created",
		"event_id": created.Id,
		"htmlLink": created.HtmlLink,
	})
}
