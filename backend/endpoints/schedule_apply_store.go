package endpoints

import "context"

func markScheduleApplied(ctx context.Context, scheduleID int) error {
	_, err := DB.ExecContext(ctx, `
		UPDATE schedules
		SET status = 'applied',
		    applied_at = NOW()
		WHERE id = $1
	`, scheduleID)
	return err
}

func saveScheduleEvent(
	ctx context.Context,
	scheduleID int,
	userID int,
	googleEventID string,
	htmlLink string,
	title string,
	startTime string,
	endTime string,
) error {
	_, err := DB.ExecContext(ctx, `
		INSERT INTO schedule_events (
			schedule_id,
			user_id,
			google_event_id,
			html_link,
			title,
			start_time,
			end_time
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, scheduleID, userID, googleEventID, htmlLink, title, startTime, endTime)

	return err
}

func getScheduleEvents(ctx context.Context, userID int) ([]map[string]any, error) {
	rows, err := DB.QueryContext(ctx, `
		SELECT id, schedule_id, google_event_id, COALESCE(html_link, ''), title, start_time, end_time, created_at
		FROM schedule_events
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 100
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]any
	for rows.Next() {
		var id int
		var scheduleID int
		var googleEventID string
		var htmlLink string
		var title string
		var startTime string
		var endTime string
		var createdAt string

		if err := rows.Scan(&id, &scheduleID, &googleEventID, &htmlLink, &title, &startTime, &endTime, &createdAt); err != nil {
			return nil, err
		}

		out = append(out, map[string]any{
			"id":              id,
			"schedule_id":     scheduleID,
			"google_event_id": googleEventID,
			"html_link":       htmlLink,
			"title":           title,
			"start_time":      startTime,
			"end_time":        endTime,
			"created_at":      createdAt,
		})
	}

	return out, rows.Err()
}
