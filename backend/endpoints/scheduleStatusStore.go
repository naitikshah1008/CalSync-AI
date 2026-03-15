package endpoints

import (
	"context"
	"database/sql"
)

type ScheduleStatusRecord struct {
	ID        int
	UserID    int
	Status    string
	AppliedAt sql.NullString
}

func getScheduleStatus(ctx context.Context, scheduleID int, userID int) (*ScheduleStatusRecord, error) {
	row := DB.QueryRowContext(ctx, `
		SELECT id, user_id, status, applied_at
		FROM schedules
		WHERE id = $1 AND user_id = $2
	`, scheduleID, userID)
	var rec ScheduleStatusRecord
	if err := row.Scan(&rec.ID, &rec.UserID, &rec.Status, &rec.AppliedAt); err != nil {
		return nil, err
	}
	return &rec, nil
}
