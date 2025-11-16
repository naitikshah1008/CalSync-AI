package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

type CredentialsPayload struct {
	ClientID     string   `json:"client_id"`
	ClientSecret string   `json:"client_secret"`
	RedirectURIs []string `json:"redirect_uris"`
}

func main() {
	mux := http.NewServeMux()

	// API endpoint
	mux.HandleFunc("/api/google/credentials", handleCredentials)

	// Serve frontend
	frontendDir := filepath.Join("..", "frontend")
	fs := http.FileServer(http.Dir(frontendDir))
	mux.Handle("/", fs)

	addr := ":8080"
	log.Printf("Server running at http://localhost%v\n", addr)
	log.Printf("Serving frontend from %s\n", frontendDir)
	http.ListenAndServe(addr, mux)
}

func handleCredentials(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload CredentialsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	if payload.ClientID == "" || payload.ClientSecret == "" || len(payload.RedirectURIs) == 0 {
		http.Error(w, "Missing client_id, client_secret, or redirect_uris", http.StatusBadRequest)
		return
	}

	// Build proper Google credentials.json format
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

	// Save credentials.json in backend folder
	outputPath := "credentials.json"
	if err := os.WriteFile(outputPath, data, 0600); err != nil {
		http.Error(w, "Failed to save credentials.json", http.StatusInternalServerError)
		return
	}

	log.Printf("Saved credentials to %s\n", outputPath)

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `{"status":"ok"}`)
}
