package endpoints

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/googleapi"
)

type LearningPlanRequest struct {
	Goal       string `json:"goal"`
	TotalHours int    `json:"total_hours"`
}

type Preferences struct {
	StartHour            int    `json:"start_hour"`
	EndHour              int    `json:"end_hour"`
	SessionLengthMinutes int    `json:"session_length_minutes"`
	DaysPerWeek          int    `json:"days_per_week"`
	DayType              string `json:"day_type"`
	TimeZone             string `json:"time_zone,omitempty"`
}

type ScheduleRequest struct {
	SavedLearningPlanID *int             `json:"saved_learning_plan_id"`
	LearningPlan        []map[string]any `json:"learning_plan"`
	Preferences         Preferences      `json:"preferences"`
}

type ApplyScheduleRequest struct {
	SavedScheduleID *int               `json:"saved_schedule_id"`
	Schedule        []ScheduledSession `json:"schedule"`
	Apply           bool               `json:"apply"`
}

type UnapplyScheduleRequest struct {
	SavedScheduleID *int `json:"saved_schedule_id"`
}

type ScheduledSession struct {
	Topic         string   `json:"topic"`
	SessionNumber int      `json:"session_number"`
	Subtopics     []string `json:"subtopics"`
	Start         string   `json:"start"`
	End           string   `json:"end"`
}
type SaveLearningPlanRequest struct {
	Goal         string           `json:"goal"`
	TotalHours   int              `json:"total_hours"`
	LearningPlan []map[string]any `json:"learning_plan"`
}

type SaveScheduleRequest struct {
	SavedLearningPlanID *int             `json:"saved_learning_plan_id"`
	LearningPlanGoal    string           `json:"learning_plan_goal"`
	LearningPlanHours   int              `json:"learning_plan_total_hours"`
	LearningPlan        []map[string]any `json:"learning_plan"`
	Preferences         Preferences      `json:"preferences"`
	Schedule            []map[string]any `json:"schedule"`
}

type UpdateLearningPlanRequest struct {
	SavedLearningPlanID *int             `json:"saved_learning_plan_id"`
	LearningPlan        []map[string]any `json:"learning_plan"`
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
	if _, err := currentUserFromRequest(r); err != nil {
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
		TimeMax(nextYearRFC3339()).
		MaxResults(2500).
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
	fallback := buildFallbackSchedule(req.LearningPlan, req.Preferences, calendarEvents)
	writeJSON(w, http.StatusOK, map[string]any{
		"schedule": fallback,
		"source":   "deterministic_scheduler",
	})
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
	if req.Apply && req.SavedScheduleID == nil {
		http.Error(w, "saved_schedule_id is required when applying a schedule", http.StatusBadRequest)
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
	createdEvents := make([]AppliedCalendarEvent, 0, len(req.Schedule))
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
			cleanupCreatedCalendarEvents(r.Context(), srv, createdEvents)
			http.Error(w, "failed to create calendar event: "+err.Error(), http.StatusInternalServerError)
			return
		}
		createdEvents = append(createdEvents, AppliedCalendarEvent{
			GoogleEventID: created.Id,
			HTMLLink:      created.HtmlLink,
			Title:         title,
			StartTime:     session.Start,
			EndTime:       session.End,
		})
	}
	if !req.Apply {
		writeJSON(w, http.StatusOK, map[string]any{
			"mode":         "dry-run",
			"would_create": previewEvents,
		})
		return
	}
	if req.SavedScheduleID != nil {
		if err := saveAppliedScheduleMetadata(r.Context(), *req.SavedScheduleID, user.ID, createdEvents); err != nil {
			cleanupCreatedCalendarEvents(r.Context(), srv, createdEvents)
			http.Error(w, "failed to save applied schedule metadata", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"mode":           "applied",
		"events_created": previewEvents,
	})
}

func cleanupCreatedCalendarEvents(ctx context.Context, srv *calendar.Service, events []AppliedCalendarEvent) {
	for _, ev := range events {
		if ev.GoogleEventID == "" {
			continue
		}
		_ = srv.Events.Delete("primary", ev.GoogleEventID).Context(ctx).Do()
	}
}

func isGoogleCalendarNotFound(err error) bool {
	var googleErr *googleapi.Error
	return errors.As(err, &googleErr) &&
		(googleErr.Code == http.StatusNotFound || googleErr.Code == http.StatusGone)
}

func UnapplyScheduleHandler(w http.ResponseWriter, r *http.Request) {
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
	var req UnapplyScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if req.SavedScheduleID == nil {
		http.Error(w, "missing saved_schedule_id", http.StatusBadRequest)
		return
	}
	rec, err := getScheduleStatus(r.Context(), *req.SavedScheduleID, user.ID)
	if err != nil {
		http.Error(w, "failed to load saved schedule", http.StatusNotFound)
		return
	}
	if rec.Status != "applied" {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":             "This schedule is not currently applied.",
			"saved_schedule_id": rec.ID,
			"status":            rec.Status,
		})
		return
	}
	srv, err := getCalendarServiceForUser(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "failed to init calendar service: "+err.Error(), http.StatusInternalServerError)
		return
	}
	linkedEvents, err := getScheduleEventsByScheduleID(r.Context(), *req.SavedScheduleID, user.ID)
	if err != nil {
		http.Error(w, "failed to load linked schedule events", http.StatusInternalServerError)
		return
	}
	deletedGoogleEvents := 0
	for _, ev := range linkedEvents {
		err := srv.Events.Delete("primary", ev.GoogleEventID).Do()
		if err == nil {
			deletedGoogleEvents++
			continue
		}
		if isGoogleCalendarNotFound(err) {
			continue
		}
		http.Error(w, "failed to delete calendar event: "+err.Error(), http.StatusBadGateway)
		return
	}
	if _, err := DB.ExecContext(r.Context(), `
		DELETE FROM schedule_events
		WHERE schedule_id = $1 AND user_id = $2
	`, *req.SavedScheduleID, user.ID); err != nil {
		http.Error(w, "failed to delete schedule event metadata", http.StatusInternalServerError)
		return
	}
	if err := markScheduleDraft(r.Context(), *req.SavedScheduleID); err != nil {
		http.Error(w, "failed to mark schedule as draft", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":                "unapplied",
		"saved_schedule_id":     *req.SavedScheduleID,
		"deleted_google_events": deletedGoogleEvents,
	})
}

func markScheduleDraft(ctx context.Context, scheduleID int) error {
	_, err := DB.ExecContext(ctx, `
		UPDATE schedules
		SET status = 'draft',
		    applied_at = NULL
		WHERE id = $1
	`, scheduleID)
	return err
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
	if err := syncScheduleEventsWithCalendar(r.Context(), user.ID); err != nil {
		http.Error(w, "failed to sync schedule events", http.StatusInternalServerError)
		return
	}
	items, err := getActiveScheduleEvents(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "failed to load schedule events", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"schedule_events": items,
	})
}

func DeleteLearningPlanHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	user, err := currentUserFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	res, err := DB.ExecContext(r.Context(), `
		DELETE FROM learning_plans
		WHERE id = $1 AND user_id = $2
	`, id, user.ID)
	if err != nil {
		http.Error(w, "failed to delete learning plan", http.StatusInternalServerError)
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "learning plan not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "deleted",
		"id":     id,
	})
}

func DeleteScheduleHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	user, err := currentUserFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var status string
	err = DB.QueryRowContext(r.Context(), `
		SELECT status
		FROM schedules
		WHERE id = $1 AND user_id = $2
	`, id, user.ID).Scan(&status)
	if err != nil {
		http.Error(w, "schedule not found", http.StatusNotFound)
		return
	}
	srv, err := getCalendarServiceForUser(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "failed to init calendar service: "+err.Error(), http.StatusInternalServerError)
		return
	}
	linkedEvents, err := getScheduleEventsByScheduleID(r.Context(), id, user.ID)
	if err != nil {
		http.Error(w, "failed to load linked schedule events", http.StatusInternalServerError)
		return
	}
	deletedGoogleEvents := 0
	for _, ev := range linkedEvents {
		err := srv.Events.Delete("primary", ev.GoogleEventID).Do()
		if err == nil {
			deletedGoogleEvents++
			continue
		}
		if isGoogleCalendarNotFound(err) {
			continue
		}
		http.Error(w, "failed to delete calendar event: "+err.Error(), http.StatusBadGateway)
		return
	}
	_, err = DB.ExecContext(r.Context(), `
		DELETE FROM schedule_events
		WHERE schedule_id = $1 AND user_id = $2
	`, id, user.ID)
	if err != nil {
		http.Error(w, "failed to delete schedule event metadata", http.StatusInternalServerError)
		return
	}
	res, err := DB.ExecContext(r.Context(), `
		DELETE FROM schedules
		WHERE id = $1 AND user_id = $2
	`, id, user.ID)
	if err != nil {
		http.Error(w, "failed to delete schedule", http.StatusInternalServerError)
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "schedule not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":                "deleted",
		"id":                    id,
		"previous_status":       status,
		"deleted_google_events": deletedGoogleEvents,
	})
}

func SaveLearningPlanHandler(w http.ResponseWriter, r *http.Request) {
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
	var req SaveLearningPlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	payload := map[string]any{
		"learning_plan": req.LearningPlan,
	}
	planID, err := saveLearningPlan(r.Context(), user.ID, req.Goal, req.TotalHours, payload)
	if err != nil {
		http.Error(w, "failed to save learning plan", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"saved_learning_plan_id": planID,
	})
}

func UpdateLearningPlanHandler(w http.ResponseWriter, r *http.Request) {
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
	var req UpdateLearningPlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if req.SavedLearningPlanID == nil {
		http.Error(w, "missing saved_learning_plan_id", http.StatusBadRequest)
		return
	}
	payload := map[string]any{
		"learning_plan": req.LearningPlan,
	}
	if err := updateLearningPlan(r.Context(), user.ID, *req.SavedLearningPlanID, payload); err != nil {
		if errors.Is(err, ErrRecordNotFound) {
			http.Error(w, "learning plan not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to update learning plan", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"saved_learning_plan_id": *req.SavedLearningPlanID,
		"status":                 "updated",
	})
}

func SaveScheduleHandler(w http.ResponseWriter, r *http.Request) {
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
	var req SaveScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	learningPlanID := req.SavedLearningPlanID
	// If frontend sent a learning plan id, first verify it still exists
	// for this user. If it was deleted, treat it as missing and recreate it.
	if learningPlanID != nil {
		var existingID int
		err := DB.QueryRowContext(r.Context(), `
			SELECT id
			FROM learning_plans
			WHERE id = $1 AND user_id = $2
		`, *learningPlanID, user.ID).Scan(&existingID)
		if err != nil {
			learningPlanID = nil
		}
	}
	if learningPlanID == nil {
		payload := map[string]any{
			"learning_plan": req.LearningPlan,
		}
		newPlanID, err := saveLearningPlan(
			r.Context(),
			user.ID,
			req.LearningPlanGoal,
			req.LearningPlanHours,
			payload,
		)
		if err != nil {
			http.Error(w, "failed to save linked learning plan", http.StatusInternalServerError)
			return
		}
		learningPlanID = &newPlanID
	}
	schedulePayload := map[string]any{
		"schedule": req.Schedule,
	}
	scheduleID, err := saveSchedule(r.Context(), user.ID, learningPlanID, req.Preferences, schedulePayload)
	if err != nil {
		http.Error(w, "failed to save schedule", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"saved_learning_plan_id": learningPlanID,
		"saved_schedule_id":      scheduleID,
	})
}
