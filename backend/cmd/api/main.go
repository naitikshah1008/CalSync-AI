package main

import (
	"calsync-ai-backend/endpoints"
	"log"
	"net/http"
	// module name + /endpoints
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/calendar/google-calendar", endpoints.GoogleCalendarHandler)

	addr := ":6000"
	log.Printf("Server running at http://localhost%v\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
