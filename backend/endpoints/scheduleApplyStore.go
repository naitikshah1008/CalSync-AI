package endpoints

import (
	"context"
	"database/sql"
)

type AppliedCalendarEvent struct {
	GoogleEventID string
	HTMLLink      string
	Title         string
	StartTime     string
	EndTime       string
}

func markScheduleApplied(ctx context.Context, scheduleID int) error {
	_, err := DB.ExecContext(ctx, `
		UPDATE schedules
		SET status = 'applied',
		    applied_at = NOW()
		WHERE id = $1
	`, scheduleID)
	return err
}

func saveAppliedScheduleMetadata(ctx context.Context, scheduleID int, userID int, events []AppliedCalendarEvent) error {
	tx, err := DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, ev := range events {
		if err := saveScheduleEventTx(ctx, tx, scheduleID, userID, ev); err != nil {
			return err
		}
	}
	res, err := tx.ExecContext(ctx, `
		UPDATE schedules
		SET status = 'applied',
		    applied_at = NOW()
		WHERE id = $1 AND user_id = $2
	`, scheduleID, userID)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrRecordNotFound
	}
	return tx.Commit()
}

func saveScheduleEventTx(ctx context.Context, tx *sql.Tx, scheduleID int, userID int, ev AppliedCalendarEvent) error {
	_, err := tx.ExecContext(ctx, `
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
	`, scheduleID, userID, ev.GoogleEventID, ev.HTMLLink, ev.Title, ev.StartTime, ev.EndTime)
	return err
}
