package endpoints

import (
	"fmt"
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
	usedWeekCounts := map[string]int{}
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
			slotStart, slotEnd, nextDay, ok := findNextAvailableSlot(
				startDay,
				preferences,
				calendarEvents,
				usedDays,
				usedWeekCounts,
				sessionDuration,
			)
			if !ok {
				continue
			}
			dayKey := slotStart.Format("2006-01-02")
			weekKey := isoWeekKey(slotStart)
			usedDays[dayKey] = true
			usedWeekCounts[weekKey]++
			startDay = nextDay
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
				"start":          slotStart.Format(time.RFC3339),
				"end":            slotEnd.Format(time.RFC3339),
			})
		}
	}
	return out
}

func findNextAvailableSlot(
	startDay time.Time,
	preferences Preferences,
	calendarEvents []map[string]any,
	usedDays map[string]bool,
	usedWeekCounts map[string]int,
	sessionDuration time.Duration,
) (time.Time, time.Time, time.Time, bool) {
	day := startDay
	for attempts := 0; attempts < 366; attempts++ {
		dayKey := day.Format("2006-01-02")
		weekKey := isoWeekKey(day)
		if !matchesDayPreference(day, preferences.DayType) {
			day = day.AddDate(0, 0, 1)
			continue
		}
		if usedDays[dayKey] {
			day = day.AddDate(0, 0, 1)
			continue
		}
		maxDaysPerWeek := preferences.DaysPerWeek
		if maxDaysPerWeek <= 0 {
			maxDaysPerWeek = 1
		}
		if usedWeekCounts[weekKey] >= maxDaysPerWeek {
			day = day.AddDate(0, 0, 1)
			continue
		}
		slotStart, slotEnd, ok := findAvailableSlotOnDay(day, preferences, calendarEvents, sessionDuration)
		if ok {
			return slotStart, slotEnd, day.AddDate(0, 0, 1), true
		}
		day = day.AddDate(0, 0, 1)
	}
	return time.Time{}, time.Time{}, time.Time{}, false
}

func findAvailableSlotOnDay(
	day time.Time,
	preferences Preferences,
	calendarEvents []map[string]any,
	sessionDuration time.Duration,
) (time.Time, time.Time, bool) {
	startHour := preferences.StartHour
	endHour := preferences.EndHour
	if endHour <= startHour {
		return time.Time{}, time.Time{}, false
	}
	windowStart := time.Date(day.Year(), day.Month(), day.Day(), startHour, 0, 0, 0, day.Location())
	windowEnd := time.Date(day.Year(), day.Month(), day.Day(), endHour, 0, 0, 0, day.Location())
	for slotStart := windowStart; slotStart.Add(sessionDuration).Before(windowEnd) || slotStart.Add(sessionDuration).Equal(windowEnd); slotStart = slotStart.Add(30 * time.Minute) {
		slotEnd := slotStart.Add(sessionDuration)
		if !hasEventConflict(slotStart, slotEnd, calendarEvents) {
			return slotStart, slotEnd, true
		}
	}
	return time.Time{}, time.Time{}, false
}

func hasEventConflict(slotStart, slotEnd time.Time, calendarEvents []map[string]any) bool {
	for _, ev := range calendarEvents {
		startStr, _ := ev["start"].(string)
		endStr, _ := ev["end"].(string)
		if startStr == "" || endStr == "" {
			continue
		}
		evStart, ok1 := parseCalendarTime(startStr, slotStart.Location())
		evEnd, ok2 := parseCalendarTime(endStr, slotStart.Location())
		if !ok1 || !ok2 {
			continue
		}
		if slotStart.Before(evEnd) && evStart.Before(slotEnd) {
			return true
		}
	}
	return false
}

func parseCalendarTime(value string, loc *time.Location) (time.Time, bool) {
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t, true
	}
	if t, err := time.ParseInLocation("2006-01-02", value, loc); err == nil {
		return t, true
	}
	return time.Time{}, false
}

func isoWeekKey(day time.Time) string {
	year, week := day.ISOWeek()
	return fmt.Sprintf("%04d-W%02d", year, week)
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

func matchesDayPreference(day time.Time, dayType string) bool {
	weekday := day.Weekday()
	switch dayType {
	case "weekdays":
		return weekday >= time.Monday && weekday <= time.Friday
	case "weekends":
		return weekday == time.Saturday || weekday == time.Sunday
	case "both", "":
		return true
	default:
		return true
	}
}
