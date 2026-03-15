package endpoints

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type LearningPlanRequest struct {
	Goal       string `json:"goal"`
	TotalHours int    `json:"total_hours"`
}

type Preferences struct {
	StartHour            int `json:"start_hour"`
	EndHour              int `json:"end_hour"`
	SessionLengthMinutes int `json:"session_length_minutes"`
	DaysPerWeek          int `json:"days_per_week"`
}

type ScheduleRequest struct {
	LearningPlan []map[string]any `json:"learning_plan"`
	Preferences  Preferences      `json:"preferences"`
}

type ApplyScheduleRequest struct {
	SavedScheduleID *int               `json:"saved_schedule_id"`
	Schedule        []ScheduledSession `json:"schedule"`
	Apply           bool               `json:"apply"`
}

type ScheduledSession struct {
	Topic         string   `json:"topic"`
	SessionNumber int      `json:"session_number"`
	Subtopics     []string `json:"subtopics"`
	Start         string   `json:"start"`
	End           string   `json:"end"`
}

func GenerateLearningPlanHandler(w http.ResponseWriter, r *http.Request) {
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

	var req LearningPlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	resp, err := postJSONToBrain("/ai/generate-learning-plan", req)
	if err != nil {
		http.Error(w, "failed to call brain service: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "failed to read brain response", http.StatusBadGateway)
		return
	}

	if resp.StatusCode >= 400 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(raw)
		return
	}

	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		http.Error(w, "failed to parse brain response", http.StatusBadGateway)
		return
	}

	planID, err := saveLearningPlan(r.Context(), user.ID, req.Goal, req.TotalHours, parsed)
	if err != nil {
		http.Error(w, "failed to save learning plan", http.StatusInternalServerError)
		return
	}

	parsed["saved_learning_plan_id"] = planID
	writeJSON(w, http.StatusOK, parsed)
}

func GenerateScheduleHandler(w http.ResponseWriter, r *http.Request) {
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

	var req ScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	srv, err := getCalendarServiceForUser(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "failed to init calendar service: "+err.Error(), http.StatusInternalServerError)
		return
	}

	events, err := srv.Events.List("primary").
		ShowDeleted(false).
		SingleEvents(true).
		OrderBy("startTime").
		TimeMin(nowRFC3339()).
		TimeMax(nextWeekRFC3339()).
		MaxResults(50).
		Do()
	if err != nil {
		http.Error(w, "failed to fetch calendar events: "+err.Error(), http.StatusInternalServerError)
		return
	}

	calendarEvents := make([]map[string]any, 0, len(events.Items))
	for _, e := range events.Items {
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

		calendarEvents = append(calendarEvents, map[string]any{
			"summary": e.Summary,
			"start":   start,
			"end":     end,
		})
	}

	brainPayload := map[string]any{
		"learning_plan":   req.LearningPlan,
		"preferences":     req.Preferences,
		"calendar_events": calendarEvents,
	}

	resp, err := postJSONToBrain("/ai/generate-schedule", brainPayload)
	if err != nil {
		http.Error(w, "failed to call brain service: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "failed to read brain response", http.StatusBadGateway)
		return
	}

	if resp.StatusCode >= 400 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(raw)
		return
	}

	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		http.Error(w, "failed to parse brain response", http.StatusBadGateway)
		return
	}

	scheduleID, err := saveSchedule(r.Context(), user.ID, nil, req.Preferences, parsed)
	if err != nil {
		http.Error(w, "failed to save schedule", http.StatusInternalServerError)
		return
	}

	parsed["saved_schedule_id"] = scheduleID
	writeJSON(w, http.StatusOK, parsed)
}

func ApplyScheduleHandler(w http.ResponseWriter, r *http.Request) {
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

	var req ApplyScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	if req.SavedScheduleID != nil {
		rec, err := getScheduleStatus(r.Context(), *req.SavedScheduleID, user.ID)
		if err != nil {
			http.Error(w, "failed to load saved schedule", http.StatusNotFound)
			return
		}

		if req.Apply && rec.Status == "applied" {
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":             "This schedule has already been applied.",
				"saved_schedule_id": rec.ID,
				"status":            rec.Status,
			})
			return
		}
	}

	srv, err := getCalendarServiceForUser(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "failed to init calendar service: "+err.Error(), http.StatusInternalServerError)
		return
	}

	previewEvents := make([]map[string]any, 0, len(req.Schedule))

	for _, session := range req.Schedule {
		title := fmt.Sprintf(
			"%s (Session %d): %s",
			session.Topic,
			session.SessionNumber,
			joinSubtopics(session.Subtopics),
		)

		description := fmt.Sprintf(
			"Learning session generated by CalSync AI\n\nTopic: %s\nSession: %d\nSubtopics: %s",
			session.Topic,
			session.SessionNumber,
			joinSubtopics(session.Subtopics),
		)

		previewEvents = append(previewEvents, map[string]any{
			"title": title,
			"start": session.Start,
			"end":   session.End,
		})

		if !req.Apply {
			continue
		}

		event := buildCalendarEvent(title, description, session.Start, session.End)
		created, err := srv.Events.Insert("primary", event).Do()
		if err != nil {
			http.Error(w, "failed to create calendar event: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if req.SavedScheduleID != nil {
			if err := saveScheduleEvent(
				r.Context(),
				*req.SavedScheduleID,
				user.ID,
				created.Id,
				created.HtmlLink,
				title,
				session.Start,
				session.End,
			); err != nil {
				http.Error(w, "failed to save schedule event metadata", http.StatusInternalServerError)
				return
			}
		}
	}

	if !req.Apply {
		writeJSON(w, http.StatusOK, map[string]any{
			"mode":         "dry-run",
			"would_create": previewEvents,
		})
		return
	}

	if req.SavedScheduleID != nil {
		if err := markScheduleApplied(r.Context(), *req.SavedScheduleID); err != nil {
			http.Error(w, "failed to mark schedule applied", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"mode":           "applied",
		"events_created": previewEvents,
	})
}

func copyJSONResponse(w http.ResponseWriter, resp *http.Response) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "failed to read brain response", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(body)
}

func ListLearningPlansHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user, err := currentUserFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	items, err := getRecentLearningPlans(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "failed to load learning plans", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"learning_plans": items,
	})
}

func ListSchedulesHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user, err := currentUserFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	items, err := getRecentSchedules(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "failed to load schedules", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"schedules": items,
	})
}

func postJSONToBrain(path string, payload any) (*http.Response, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	client := &http.Client{
		Timeout: 300 * time.Second,
	}

	req, err := http.NewRequest(http.MethodPost, AppConfig.BrainBaseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	return client.Do(req)
}

func ListScheduleEventsHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user, err := currentUserFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	items, err := getScheduleEvents(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "failed to load schedule events", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"schedule_events": items,
	})
}
