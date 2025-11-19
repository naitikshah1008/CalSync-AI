package endpoints

import (
	"encoding/json"
	"fmt"
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
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

	// Handle CORS preflight (very important for POST requests)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	switch r.Method {
	case http.MethodGet:
		googleCalendarGet(w, r)
	case http.MethodPost:
		googleCalendarPost(w, r)
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

func googleCalendarPost(w http.ResponseWriter, r *http.Request) {
	var payload CredentialsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	if payload.ClientID == "" || payload.ClientSecret == "" || len(payload.RedirectURIs) == 0 {
		http.Error(w, "Missing client_id, client_secret, or redirect_uris", http.StatusBadRequest)
		return
	}

	credsFile := map[string]any{
		"installed": map[string]any{
			"client_id":                   payload.ClientID,
			"project_id":                  "user-project",
			"auth_uri":                    "https://accounts.google.com/o/oauth2/auth",
			"token_uri":                   "https://oauth2.googleapis.com/token",
			"auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
			"client_secret":               payload.ClientSecret,
			"redirect_uris":               payload.RedirectURIs,
		},
	}

	data, err := json.MarshalIndent(credsFile, "", "  ")
	if err != nil {
		http.Error(w, "Failed to marshal credentials", http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile("data/credentials.json", data, 0600); err != nil {
		http.Error(w, "Failed to save credentials.json", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `{"status":"ok"}`)
}

func isGoogleCalendarConnected() bool {
	if _, err := os.Stat("credentials.json"); err != nil {
		return false
	}
	return true
}
