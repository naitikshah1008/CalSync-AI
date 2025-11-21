package main

import (
	"calsync-ai-backend/endpoints"
	"calsync-ai-backend/internal"
	"log"
	"net/http"
)

func initApp() (http.Handler, error) {
	// 1) init CSV logging
	if err := internal.InitRequestLogger("logs/requests_log.csv"); err != nil {
		return nil, err
	}
	// 2) register routes
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/calendar/google-calendar", endpoints.GoogleCalendarHandler)
	mux.HandleFunc("/api/v1/calendar/auth-url", endpoints.GoogleOAuthURLHandler)
	mux.HandleFunc("/callback", endpoints.GoogleOAuthCallbackHandler)
	// 3) wrap with logging middleware
	return internal.LoggingMiddleware(mux), nil
}

func main() {
	handler, err := initApp()
	if err != nil {
		log.Fatalf("failed to init app: %v", err)
	}
	defer internal.CloseRequestLogger()
	addr := ":8080"
	log.Printf("Server running at http://localhost%s\n", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
