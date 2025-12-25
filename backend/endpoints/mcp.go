package endpoints

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"google.golang.org/api/calendar/v3"
)

// MCP Request / Response Types
type MCPRequest struct {
	Tool string                 `json:"tool"`
	Args map[string]interface{} `json:"args"`
}

type MCPResponse struct {
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

// MCP HTTP Handler
func MCPHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers (optional but useful)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}
	var req MCPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(MCPResponse{Error: "Invalid JSON"})
		return
	}
	switch req.Tool {
	// TOOL 1: list_calendar_events
	case "list_calendar_events":
		events, err := MCPListCalendarEvents()
		if err != nil {
			json.NewEncoder(w).Encode(MCPResponse{Error: err.Error()})
			return
		}
		json.NewEncoder(w).Encode(MCPResponse{Result: events})
		return
	// TOOL 2: create_calendar_event
	case "create_calendar_event":
		result, err := MCPCreateCalendarEvent(req.Args)
		if err != nil {
			json.NewEncoder(w).Encode(MCPResponse{Error: err.Error()})
			return
		}
		json.NewEncoder(w).Encode(MCPResponse{Result: result})
		return
	default:
		json.NewEncoder(w).Encode(MCPResponse{
			Error: "Unknown tool: " + req.Tool,
		})
		return
	}
}

// TOOL IMPLEMENTATIONS
// TOOL: list_calendar_events
func MCPListCalendarEvents() ([]SimpleEvent, error) {
	ctx := context.Background()
	srv, err := getCalendarService(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to init calendar service: %w", err)
	}
	now := time.Now()
	timeMin := now.Format(time.RFC3339)
	timeMax := now.Add(7 * 24 * time.Hour).Format(time.RFC3339)
	call := srv.Events.List("primary").
		ShowDeleted(false).
		SingleEvents(true).
		OrderBy("startTime").
		TimeMin(timeMin).
		TimeMax(timeMax).
		MaxResults(20)
	resp, err := call.Do()
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
				start = e.Start.Date // all-day
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

// TOOL: create_calendar_event
func MCPCreateCalendarEvent(args map[string]interface{}) (interface{}, error) {
	summary, _ := args["summary"].(string)
	description, _ := args["description"].(string)
	start, _ := args["start"].(string)
	end, _ := args["end"].(string)
	if summary == "" || start == "" || end == "" {
		return nil, fmt.Errorf("missing required fields: summary, start, end")
	}
	ctx := context.Background()
	srv, err := getCalendarService(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to init calendar service: %w", err)
	}
	event := &calendar.Event{
		Summary:     summary,
		Description: description,
		Start: &calendar.EventDateTime{
			DateTime: start,
			TimeZone: "America/Los_Angeles", // adjust if needed
		},
		End: &calendar.EventDateTime{
			DateTime: end,
			TimeZone: "America/Los_Angeles",
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
