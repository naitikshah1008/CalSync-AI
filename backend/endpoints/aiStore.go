package endpoints

import (
	"context"
	"database/sql"
	"encoding/json"
)

func saveLearningPlan(ctx context.Context, userID int, goal string, totalHours int, plan any) (int, error) {
	planJSON, err := json.Marshal(plan)
	if err != nil {
		return 0, err
	}
	var id int
	err = DB.QueryRowContext(ctx, `
		INSERT INTO learning_plans (user_id, goal, total_hours, plan_json)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, userID, goal, totalHours, planJSON).Scan(&id)
	return id, err
}

func saveSchedule(ctx context.Context, userID int, learningPlanID *int, preferences any, schedule any) (int, error) {
	prefsJSON, err := json.Marshal(preferences)
	if err != nil {
		return 0, err
	}
	scheduleJSON, err := json.Marshal(schedule)
	if err != nil {
		return 0, err
	}
	var nullablePlanID any
	if learningPlanID != nil {
		nullablePlanID = *learningPlanID
	} else {
		nullablePlanID = nil
	}
	var id int
	err = DB.QueryRowContext(ctx, `
		INSERT INTO schedules (user_id, learning_plan_id, preferences_json, schedule_json)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, userID, nullablePlanID, prefsJSON, scheduleJSON).Scan(&id)
	return id, err
}

func getRecentLearningPlans(ctx context.Context, userID int) ([]map[string]any, error) {
	rows, err := DB.QueryContext(ctx, `
		SELECT id, goal, total_hours, plan_json, created_at
		FROM learning_plans
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 20
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var id int
		var goal string
		var totalHours sql.NullInt32
		var planJSON []byte
		var createdAt string
		if err := rows.Scan(&id, &goal, &totalHours, &planJSON, &createdAt); err != nil {
			return nil, err
		}
		var parsed any
		if err := json.Unmarshal(planJSON, &parsed); err != nil {
			return nil, err
		}
		item := map[string]any{
			"id":         id,
			"goal":       goal,
			"plan":       parsed,
			"created_at": createdAt,
		}
		if totalHours.Valid {
			item["total_hours"] = totalHours.Int32
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func getRecentSchedules(ctx context.Context, userID int) ([]map[string]any, error) {
	rows, err := DB.QueryContext(ctx, `
		SELECT id, learning_plan_id, preferences_json, schedule_json, status, applied_at, created_at
		FROM schedules
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 20
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var id int
		var learningPlanID sql.NullInt32
		var prefsJSON []byte
		var scheduleJSON []byte
		var status string
		var appliedAt sql.NullString
		var createdAt string
		if err := rows.Scan(&id, &learningPlanID, &prefsJSON, &scheduleJSON, &status, &appliedAt, &createdAt); err != nil {
			return nil, err
		}
		var prefs any
		var schedule any
		if err := json.Unmarshal(prefsJSON, &prefs); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(scheduleJSON, &schedule); err != nil {
			return nil, err
		}
		item := map[string]any{
			"id":          id,
			"preferences": prefs,
			"schedule":    schedule,
			"status":      status,
			"created_at":  createdAt,
		}
		if learningPlanID.Valid {
			item["learning_plan_id"] = learningPlanID.Int32
		}
		if appliedAt.Valid {
			item["applied_at"] = appliedAt.String
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
