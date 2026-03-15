package endpoints

import (
	"strings"
	"time"

	"google.golang.org/api/calendar/v3"
)

func nowRFC3339() string {
	return time.Now().Format(time.RFC3339)
}

func nextWeekRFC3339() string {
	return time.Now().Add(7 * 24 * time.Hour).Format(time.RFC3339)
}

func joinSubtopics(items []string) string {
	return strings.Join(items, ", ")
}

func buildCalendarEvent(summary, description, start, end string) *calendar.Event {
	return &calendar.Event{
		Summary:     summary,
		Description: description,
		Start: &calendar.EventDateTime{
			DateTime: start,
		},
		End: &calendar.EventDateTime{
			DateTime: end,
		},
	}
}
