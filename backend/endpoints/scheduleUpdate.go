package endpoints

import (
	"encoding/json"
	"net/http"
)

type UpdateSavedSchedulePayload struct {
	SavedScheduleID int `json:"saved_schedule_id"`
	Schedule        any `json:"schedule"`
}

func UpdateSavedScheduleHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	user, err := currentUserFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var payload UpdateSavedSchedulePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if payload.SavedScheduleID <= 0 {
		http.Error(w, "saved_schedule_id is required", http.StatusBadRequest)
		return
	}
	if payload.Schedule == nil {
		http.Error(w, "schedule is required", http.StatusBadRequest)
		return
	}
	if err := updateSavedSchedule(r.Context(), user.ID, payload.SavedScheduleID, map[string]any{
		"schedule": payload.Schedule,
	}); err != nil {
		http.Error(w, "failed to update saved schedule", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "saved_schedule_updated",
	})
}
