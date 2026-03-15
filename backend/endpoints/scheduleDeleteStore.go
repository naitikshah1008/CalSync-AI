package endpoints

import "context"

type ScheduleEventRecord struct {
	ID            int
	ScheduleID    int
	UserID        int
	GoogleEventID string
	HTMLLink      string
	Title         string
	StartTime     string
	EndTime       string
}

func getScheduleEventsByScheduleID(ctx context.Context, scheduleID int, userID int) ([]ScheduleEventRecord, error) {
	rows, err := DB.QueryContext(ctx, `
		SELECT id, schedule_id, user_id, google_event_id, COALESCE(html_link, ''), title, start_time, end_time
		FROM schedule_events
		WHERE schedule_id = $1 AND user_id = $2
		ORDER BY created_at DESC
	`, scheduleID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ScheduleEventRecord
	for rows.Next() {
		var item ScheduleEventRecord
		if err := rows.Scan(
			&item.ID,
			&item.ScheduleID,
			&item.UserID,
			&item.GoogleEventID,
			&item.HTMLLink,
			&item.Title,
			&item.StartTime,
			&item.EndTime,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
