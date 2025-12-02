// backend/endpoints/calendar_events.go
package endpoints

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"golang.org/x/oauth2"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

// loadToken reads data/token.json and returns an oauth2.Token
func loadToken() (*oauth2.Token, error) {
	data, err := os.ReadFile("data/token.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read token.json: %w", err)
	}

	var token oauth2.Token
	if err := json.Unmarshal(data, &token); err != nil {
		return nil, fmt.Errorf("failed to unmarshal token.json: %w", err)
	}

	return &token, nil
}

// getCalendarService builds an authenticated Google Calendar client
func getCalendarService(ctx context.Context) (*calendar.Service, error) {
	config, err := loadOAuthConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load OAuth config: %w", err)
	}

	token, err := loadToken()
	if err != nil {
		return nil, fmt.Errorf("failed to load token: %w", err)
	}

	// config.Client will automatically refresh tokens in memory if needed
	httpClient := config.Client(ctx, token)

	srv, err := calendar.NewService(ctx, option.WithHTTPClient(httpClient))
	if err != nil {
		return nil, fmt.Errorf("failed to create calendar service: %w", err)
	}

	return srv, nil
}

// SimpleEvent is what we return to the frontend
type SimpleEvent struct {
	ID      string `json:"id"`
	Summary string `json:"summary"`
	Start   string `json:"start"`
	End     string `json:"end"`
}

// GoogleListEventsHandler handles GET /api/v1/calendar/events
func GoogleListEventsHandler(w http.ResponseWriter, r *http.Request) {
	// CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	srv, err := getCalendarService(ctx)
	if err != nil {
		http.Error(w, "Failed to init Calendar service: "+err.Error(), http.StatusInternalServerError)
		return
	}

	now := time.Now()
	timeMin := now.Format(time.RFC3339)
	timeMax := now.Add(7 * 24 * time.Hour).Format(time.RFC3339) // next 7 days

	call := srv.Events.List("primary").
		ShowDeleted(false).
		SingleEvents(true).
		OrderBy("startTime").
		TimeMin(timeMin).
		TimeMax(timeMax).
		MaxResults(10)

	events, err := call.Do()
	if err != nil {
		http.Error(w, "Failed to fetch events: "+err.Error(), http.StatusInternalServerError)
		return
	}

	simpleEvents := make([]SimpleEvent, 0, len(events.Items))
	for _, e := range events.Items {
		start := ""
		end := ""

		if e.Start != nil {
			if e.Start.DateTime != "" {
				start = e.Start.DateTime
			} else {
				start = e.Start.Date // all-day events
			}
		}
		if e.End != nil {
			if e.End.DateTime != "" {
				end = e.End.DateTime
			} else {
				end = e.End.Date
			}
		}

		simpleEvents = append(simpleEvents, SimpleEvent{
			ID:      e.Id,
			Summary: e.Summary,
			Start:   start,
			End:     end,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	resp := map[string]any{
		"events": simpleEvents,
	}
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}
