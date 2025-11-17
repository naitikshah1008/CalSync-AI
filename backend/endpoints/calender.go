package endpoints

import (
	"encoding/json"
	"net/http"
	"os"
)

type CredentialsPayload struct {
	ClientID     string   `json:"client_id"`
	ClientSecret string   `json:"client_secret"`
	RedirectURIs []string `json:"redirect_uris"`
}

// GoogleCalendarHandler handles both GET and POST requests for the
// /api/v1/calendar/google-calendar endpoint.
func GoogleCalendarHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		googleCalendarGet(w, r)
	//case http.MethodPost:
	//	googleCalendarPost(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func googleCalendarGet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	connected := isGoogleCalendarConnected()

	response := map[string]any{
		"connected": connected,
	}
	if !connected {
		response["message"] = "Google Calendar not configured. credentials.json not found."
	} else {
		response["message"] = "Google Calendar credentials found."
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}

func isGoogleCalendarConnected() bool {
	if _, err := os.Stat("credentials.json"); err != nil {
		return false
	}
	return true
}
