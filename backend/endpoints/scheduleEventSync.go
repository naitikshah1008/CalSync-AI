package endpoints

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type StoredScheduleEvent struct {
	ID            int
	ScheduleID    int
	UserID        int
	GoogleEventID string
	HTMLLink      string
	Title         string
	StartTime     string
	EndTime       string
	IsDeleted     bool
}

func getStoredScheduleEventsForUser(ctx context.Context, userID int) ([]StoredScheduleEvent, error) {
	rows, err := DB.QueryContext(ctx, `
		SELECT id, schedule_id, user_id, google_event_id, COALESCE(html_link, ''), title, start_time, end_time, is_deleted
		FROM schedule_events
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []StoredScheduleEvent
	for rows.Next() {
		var item StoredScheduleEvent
		if err := rows.Scan(&item.ID, &item.ScheduleID, &item.UserID, &item.GoogleEventID, &item.HTMLLink, &item.Title, &item.StartTime, &item.EndTime, &item.IsDeleted); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func markScheduleEventDeleted(ctx context.Context, rowID int) error {
	_, err := DB.ExecContext(ctx, `
		UPDATE schedule_events
		SET is_deleted = TRUE,
		    deleted_at = NOW(),
		    last_verified_at = NOW()
		WHERE id = $1
	`, rowID)
	return err
}

func markScheduleEventVerified(ctx context.Context, rowID int, htmlLink string) error {
	_, err := DB.ExecContext(ctx, `
		UPDATE schedule_events
		SET is_deleted = FALSE,
		    deleted_at = NULL,
		    html_link = $2,
		    last_verified_at = NOW()
		WHERE id = $1
	`, rowID, htmlLink)
	return err
}

func syncScheduleEventsWithCalendar(ctx context.Context, userID int) error {
	events, err := getStoredScheduleEventsForUser(ctx, userID)
	if err != nil {
		return err
	}
	srv, err := getCalendarServiceForUser(ctx, userID)
	if err != nil {
		return err
	}
	for _, item := range events {
		ev, err := srv.Events.Get("primary", item.GoogleEventID).Do()
		if err != nil {
			if err := markScheduleEventDeleted(ctx, item.ID); err != nil {
				return fmt.Errorf("failed to mark deleted event %d: %w", item.ID, err)
			}
			continue
		}
		// Google may return a cancelled tombstone instead of a 404
		// for deleted calendar events. Treat those as deleted too.
		if ev == nil || ev.Status == "cancelled" {
			if err := markScheduleEventDeleted(ctx, item.ID); err != nil {
				return fmt.Errorf("failed to mark cancelled/deleted event %d: %w", item.ID, err)
			}
			continue
		}
		link := item.HTMLLink
		if ev.HtmlLink != "" {
			link = ev.HtmlLink
		}
		if err := markScheduleEventVerified(ctx, item.ID, link); err != nil {
			return fmt.Errorf("failed to mark verified event %d: %w", item.ID, err)
		}
	}
	return nil
}

func getActiveScheduleEvents(ctx context.Context, userID int) ([]map[string]any, error) {
	rows, err := DB.QueryContext(ctx, `
		SELECT id, schedule_id, google_event_id, COALESCE(html_link, ''), title, start_time, end_time, created_at, last_verified_at
		FROM schedule_events
		WHERE user_id = $1 AND is_deleted = FALSE
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
		var createdAt time.Time
		var lastVerifiedAt sql.NullTime
		if err := rows.Scan(&id, &scheduleID, &googleEventID, &htmlLink, &title, &startTime, &endTime, &createdAt, &lastVerifiedAt); err != nil {
			return nil, err
		}
		item := map[string]any{
			"id":              id,
			"schedule_id":     scheduleID,
			"google_event_id": googleEventID,
			"html_link":       htmlLink,
			"title":           title,
			"start_time":      startTime,
			"end_time":        endTime,
			"created_at":      createdAt.Format(time.RFC3339),
		}
		if lastVerifiedAt.Valid {
			item["last_verified_at"] = lastVerifiedAt.Time.Format(time.RFC3339)
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
