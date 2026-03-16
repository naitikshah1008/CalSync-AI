package endpoints

import (
	"math"
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

func buildFallbackSchedule(learningPlan []map[string]any, preferences Preferences, calendarEvents []map[string]any) []map[string]any {
	sessionDuration := time.Duration(preferences.SessionLengthMinutes) * time.Minute
	if sessionDuration <= 0 {
		sessionDuration = 90 * time.Minute
	}
	now := time.Now()
	startDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	var out []map[string]any
	usedDays := map[string]bool{}
	for _, item := range learningPlan {
		topic, _ := item["topic"].(string)
		var subtopics []string
		if rawSubs, ok := item["subtopics"].([]any); ok {
			for _, s := range rawSubs {
				if str, ok := s.(string); ok && strings.TrimSpace(str) != "" {
					subtopics = append(subtopics, strings.TrimSpace(str))
				}
			}
		}
		estimatedHours := 1.0
		switch v := item["estimated_hours"].(type) {
		case float64:
			if v > 0 {
				estimatedHours = v
			}
		case int:
			if v > 0 {
				estimatedHours = float64(v)
			}
		}
		hoursPerSession := float64(preferences.SessionLengthMinutes) / 60.0
		if hoursPerSession <= 0 {
			hoursPerSession = 1.5
		}
		sessionsNeeded := int(math.Ceil(estimatedHours / hoursPerSession))
		if sessionsNeeded < 1 {
			sessionsNeeded = 1
		}
		groupedSubtopics := splitSubtopics(subtopics, sessionsNeeded)
		for i := 0; i < sessionsNeeded; i++ {
			day := findNextAvailableDay(startDay, preferences, calendarEvents, usedDays)
			startTime := time.Date(
				day.Year(), day.Month(), day.Day(),
				preferences.StartHour, 0, 0, 0,
				now.Location(),
			)
			endTime := startTime.Add(sessionDuration)
			if endTime.Hour() > preferences.EndHour || (endTime.Hour() == preferences.EndHour && endTime.Minute() > 0) {
				endTime = time.Date(
					day.Year(), day.Month(), day.Day(),
					preferences.EndHour, 0, 0, 0,
					now.Location(),
				)
			}
			dayKey := day.Format("2006-01-02")
			usedDays[dayKey] = true
			startDay = day.AddDate(0, 0, 1)
			sessionSubtopics := []string{}
			if i < len(groupedSubtopics) {
				sessionSubtopics = groupedSubtopics[i]
			}
			if len(sessionSubtopics) == 0 && len(subtopics) > 0 {
				sessionSubtopics = []string{subtopics[0]}
			}
			out = append(out, map[string]any{
				"topic":          topic,
				"session_number": i + 1,
				"subtopics":      sessionSubtopics,
				"start":          startTime.Format(time.RFC3339),
				"end":            endTime.Format(time.RFC3339),
			})
		}
	}
	return out
}

func splitSubtopics(subtopics []string, groups int) [][]string {
	if groups <= 0 {
		groups = 1
	}
	if len(subtopics) == 0 {
		out := make([][]string, groups)
		for i := 0; i < groups; i++ {
			out[i] = []string{}
		}
		return out
	}
	out := make([][]string, groups)
	for i, sub := range subtopics {
		idx := i % groups
		out[idx] = append(out[idx], sub)
	}
	return out
}

func findNextAvailableDay(startDay time.Time, preferences Preferences, calendarEvents []map[string]any, usedDays map[string]bool) time.Time {
	day := startDay
	for {
		dayKey := day.Format("2006-01-02")
		if usedDays[dayKey] || dayHasConflict(day, preferences, calendarEvents) {
			day = day.AddDate(0, 0, 1)
			continue
		}
		return day
	}
}

func dayHasConflict(day time.Time, preferences Preferences, calendarEvents []map[string]any) bool {
	slotStart := time.Date(day.Year(), day.Month(), day.Day(), preferences.StartHour, 0, 0, 0, day.Location())
	slotEnd := slotStart.Add(time.Duration(preferences.SessionLengthMinutes) * time.Minute)
	for _, ev := range calendarEvents {
		startStr, _ := ev["start"].(string)
		endStr, _ := ev["end"].(string)
		if startStr == "" || endStr == "" {
			continue
		}
		evStart, err1 := time.Parse(time.RFC3339, startStr)
		evEnd, err2 := time.Parse(time.RFC3339, endStr)
		if err1 != nil || err2 != nil {
			continue
		}
		if sameDate(evStart, day) {
			if slotStart.Before(evEnd) && evStart.Before(slotEnd) {
				return true
			}
		}
	}
	return false
}

func sameDate(a, b time.Time) bool {
	return a.Year() == b.Year() && a.Month() == b.Month() && a.Day() == b.Day()
}
