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

func saveScheduleEvent(ctx context.Context, scheduleID int, userID int, googleEventID string,
	htmlLink string, title string, startTime string, endTime string) error {
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
