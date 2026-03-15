package endpoints

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"google.golang.org/api/calendar/v3"
)

type MCPRequest struct {
	Tool string                 `json:"tool"`
	Args map[string]interface{} `json:"args"`
}

type MCPResponse struct {
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

func MCPHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	user, err := currentUserFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, MCPResponse{Error: "unauthorized"})
		return
	}

	var req MCPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, MCPResponse{Error: "invalid JSON"})
		return
	}

	switch req.Tool {
	case "list_calendar_events":
		events, err := MCPListCalendarEvents(r, user.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, MCPResponse{Error: err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, MCPResponse{Result: events})
	case "create_calendar_event":
		result, err := MCPCreateCalendarEvent(r, user.ID, req.Args)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, MCPResponse{Error: err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, MCPResponse{Result: result})
	default:
		writeJSON(w, http.StatusBadRequest, MCPResponse{Error: "unknown tool: " + req.Tool})
	}
}

func MCPListCalendarEvents(r *http.Request, userID int) ([]SimpleEvent, error) {
	srv, err := getCalendarServiceForUser(r.Context(), userID)
	if err != nil {
		return nil, fmt.Errorf("failed to init calendar service: %w", err)
	}

	now := time.Now()
	resp, err := srv.Events.List("primary").
		ShowDeleted(false).
		SingleEvents(true).
		OrderBy("startTime").
		TimeMin(now.Format(time.RFC3339)).
		TimeMax(now.Add(7 * 24 * time.Hour).Format(time.RFC3339)).
		MaxResults(20).
		Do()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch events: %w", err)
	}

	events := []SimpleEvent{}
	for _, e := range resp.Items {
		start := ""
		end := ""
		if e.Start != nil {
			if e.Start.DateTime != "" {
				start = e.Start.DateTime
			} else {
				start = e.Start.Date
			}
		}
		if e.End != nil {
			if e.End.DateTime != "" {
				end = e.End.DateTime
			} else {
				end = e.End.Date
			}
		}
		events = append(events, SimpleEvent{
			ID:      e.Id,
			Summary: e.Summary,
			Start:   start,
			End:     end,
		})
	}
	return events, nil
}

func MCPCreateCalendarEvent(r *http.Request, userID int, args map[string]interface{}) (interface{}, error) {
	summary, _ := args["summary"].(string)
	description, _ := args["description"].(string)
	start, _ := args["start"].(string)
	end, _ := args["end"].(string)

	if summary == "" || start == "" || end == "" {
		return nil, fmt.Errorf("missing required fields: summary, start, end")
	}

	srv, err := getCalendarServiceForUser(r.Context(), userID)
	if err != nil {
		return nil, fmt.Errorf("failed to init calendar service: %w", err)
	}

	event := &calendar.Event{
		Summary:     summary,
		Description: description,
		Start: &calendar.EventDateTime{
			DateTime: start,
		},
		End: &calendar.EventDateTime{
			DateTime: end,
		},
	}

	created, err := srv.Events.Insert("primary", event).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to create event: %w", err)
	}

	return map[string]string{
		"event_id": created.Id,
		"htmlLink": created.HtmlLink,
	}, nil
}
