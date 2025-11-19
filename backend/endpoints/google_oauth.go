package endpoints

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// Struct matches credentials.json format
type InstalledCredentials struct {
	Installed struct {
		ClientID     string   `json:"client_id"`
		ClientSecret string   `json:"client_secret"`
		RedirectURIs []string `json:"redirect_uris"`
	} `json:"installed"`
}

// Load credentials.json and build OAuth config
func loadOAuthConfig() (*oauth2.Config, error) {
	data, err := os.ReadFile("data/credentials.json")
	if err != nil {
		return nil, fmt.Errorf("credentials.json not found: %v", err)
	}

	var creds InstalledCredentials
	if err := json.Unmarshal(data, &creds); err != nil {
		return nil, fmt.Errorf("invalid credentials.json: %v", err)
	}

	if len(creds.Installed.RedirectURIs) == 0 {
		return nil, fmt.Errorf("missing redirect_uris in credentials.json")
	}

	config := &oauth2.Config{
		ClientID:     creds.Installed.ClientID,
		ClientSecret: creds.Installed.ClientSecret,
		RedirectURL:  creds.Installed.RedirectURIs[0],
		Scopes: []string{
			"https://www.googleapis.com/auth/calendar",
			"https://www.googleapis.com/auth/calendar.events",
		},
		Endpoint: google.Endpoint,
	}

	return config, nil
}

// Handler: GET /api/v1/calendar/auth-url
func GoogleOAuthURLHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	config, err := loadOAuthConfig()
	if err != nil {
		http.Error(w, "Failed to load credentials.json: "+err.Error(), http.StatusBadRequest)
		return
	}

	// State token for security (use a random string later)
	state := "random-state"

	authURL := config.AuthCodeURL(state, oauth2.AccessTypeOffline)

	json.NewEncoder(w).Encode(map[string]string{
		"auth_url": authURL,
	})
}
