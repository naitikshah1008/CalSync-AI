const BACKEND_BASE = "";

window.currentCalendarEvents = [];

function formatEventTime(isoOrDate) {
  if (!isoOrDate) return "";
  const date = new Date(getDateValue(isoOrDate));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDateValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.dateTime || value.date || "";
}

function getInterval(item) {
  const start = new Date(getDateValue(item?.start));
  const end = new Date(getDateValue(item?.end));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }
  return {
    start,
    end,
    title: item?.topic || item?.summary || "Untitled"
  };
}

function formatDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Unknown day";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function summarizeCalendar(events) {
  const intervals = (events || [])
    .map(getInterval)
    .filter(Boolean);
  const dayCounts = new Map();
  intervals.forEach(interval => {
    const key = interval.start.toISOString().slice(0, 10);
    const existing = dayCounts.get(key) || { date: interval.start, count: 0 };
    existing.count += 1;
    dayCounts.set(key, existing);
  });
  const busiest = [...dayCounts.values()]
    .sort((a, b) => b.count - a.count || a.date - b.date)[0] || null;
  return {
    intervals,
    eventCount: intervals.length,
    busiest
  };
}

function findScheduleConflicts(scheduleItems, calendarEvents) {
  const scheduleIntervals = (scheduleItems || [])
    .map(getInterval)
    .filter(Boolean);
  const eventIntervals = (calendarEvents || [])
    .map(getInterval)
    .filter(Boolean);
  const conflicts = [];
  scheduleIntervals.forEach(session => {
    eventIntervals.forEach(event => {
      if (session.start < event.end && session.end > event.start) {
        conflicts.push({ session, event });
      }
    });
  });
  return conflicts;
}

function setInsightState(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("is-good", "is-warning", "is-danger");
  if (state) {
    el.classList.add(state);
  }
}

function updateQuickStats() {
  const intelligenceModeLabel = document.getElementById("intelligenceModeLabel");
  const intelligenceHeadline = document.getElementById("intelligenceHeadline");
  const intelligenceSummary = document.getElementById("intelligenceSummary");
  const calendarLoadValue = document.getElementById("calendarLoadValue");
  const conflictValue = document.getElementById("conflictValue");
  const proposedSessionValue = document.getElementById("proposedSessionValue");
  const calendarInsightText = document.getElementById("calendarInsightText");
  const conflictInsightText = document.getElementById("conflictInsightText");
  const nextMoveText = document.getElementById("nextMoveText");
  const goalInput = document.getElementById("goalInput");
  const hoursPerDayInput = document.getElementById("hoursPerDayInput");
  const daysPerWeekInput = document.getElementById("daysPerWeekInput");
  const dayTypeSelect = document.getElementById("dayTypeSelect");
  const goal = (goalInput?.value || "").trim();
  const dayType = dayTypeSelect?.value || "";
  const days = Number(daysPerWeekInput?.value || 0);
  const hours = Number(hoursPerDayInput?.value || 0);
  const topicsCount = Array.isArray(window.learningPlanState) ? window.learningPlanState.length : 0;
  const sessionsCount = Array.isArray(window.scheduleState) ? window.scheduleState.length : 0;
  const isSynced = Boolean(document.getElementById("deleteAppliedBtn") && !document.getElementById("deleteAppliedBtn").disabled);
  const hasGoal = Boolean(goal);
  const hasPreferences = Boolean(dayType && days > 0 && hours > 0);
  const hasPlan = topicsCount > 0;
  const hasSchedule = sessionsCount > 0;
  const calendarSummary = summarizeCalendar(window.currentCalendarEvents || []);
  const conflicts = findScheduleConflicts(window.scheduleState || [], window.currentCalendarEvents || []);
  const conflictCount = conflicts.length;
  const weeklyHours = hasPreferences ? days * hours : 0;
  const calendarInsight =
    calendarSummary.eventCount === 0 ? "No calendar events are loaded for the next 7 days." :
    calendarSummary.busiest ? `${calendarSummary.eventCount} upcoming event${calendarSummary.eventCount === 1 ? "" : "s"}. Busiest day: ${formatDay(calendarSummary.busiest.date)} with ${calendarSummary.busiest.count} event${calendarSummary.busiest.count === 1 ? "" : "s"}.` :
    `${calendarSummary.eventCount} upcoming event${calendarSummary.eventCount === 1 ? "" : "s"} loaded.`;
  const conflictInsight =
    !hasSchedule ? "Generate a schedule to scan it against your calendar." :
    conflictCount > 0 ? `${conflictCount} overlap${conflictCount === 1 ? "" : "s"} found. First: ${conflicts[0].session.title} overlaps ${conflicts[0].event.title} on ${formatDay(conflicts[0].session.start)}.` :
    calendarSummary.eventCount === 0 ? "No loaded calendar events to compare against. Refresh events before syncing." :
    "No overlaps detected between the proposed schedule and loaded calendar events.";
  const headline =
    isSynced ? "Calendar sync complete" :
    conflictCount > 0 ? "Conflict risk detected" :
    hasSchedule ? "Schedule is ready for review" :
    hasPlan ? "Plan is ready for scheduling" :
    hasGoal && hasPreferences ? "Ready to generate a plan" :
    "Waiting for schedule inputs";
  const summary =
    isSynced ? "The applied schedule is live in your calendar. Keep saved history as the source of truth for future edits." :
    conflictCount > 0 ? "Adjust the conflicting sessions before applying anything to Google Calendar." :
    hasSchedule ? "Review session timing and subtopics, then save and approve when the calendar scan looks clean." :
    hasPlan ? "Generate a schedule so CalSync can compare proposed sessions against your calendar." :
    hasGoal && hasPreferences ? `Workload target: ${weeklyHours} hour${weeklyHours === 1 ? "" : "s"} per week. Generate the plan next.` :
    "Set a goal and workload preferences to unlock calendar-aware schedule checks.";
  const nextMove =
    isSynced ? "Monitor saved history and delete applied events only if you want to unsync." :
    conflictCount > 0 ? "Move the first conflicting session, then rerun the final review before syncing." :
    hasSchedule ? "Save the schedule, then approve it once the session timing looks right." :
    hasPlan ? "Generate the schedule so conflict scanning can run." :
    hasGoal && hasPreferences ? "Generate the learning plan." :
    hasGoal ? "Choose study days, days per week, and hours per day." :
    "Start by defining the learning goal and workload.";

  if (intelligenceModeLabel) {
    intelligenceModeLabel.textContent = conflictCount > 0 ? "Action needed" : hasSchedule ? "Preflight clear" : "Preflight";
  }
  if (intelligenceHeadline) {
    intelligenceHeadline.textContent = headline;
  }
  if (intelligenceSummary) {
    intelligenceSummary.textContent = summary;
  }
  if (calendarLoadValue) {
    calendarLoadValue.textContent = calendarSummary.eventCount ? `${calendarSummary.eventCount}` : "0";
  }
  if (conflictValue) {
    conflictValue.textContent = !hasSchedule ? "Pending" : conflictCount > 0 ? `${conflictCount}` : "Clear";
  }
  if (proposedSessionValue) {
    proposedSessionValue.textContent = String(sessionsCount);
  }
  if (calendarInsightText) {
    calendarInsightText.textContent = calendarInsight;
  }
  if (conflictInsightText) {
    conflictInsightText.textContent = conflictInsight;
  }
  if (nextMoveText) {
    nextMoveText.textContent = nextMove;
  }
  setInsightState("calendarInsight", calendarSummary.eventCount > 0 ? "is-good" : "is-warning");
  setInsightState("conflictInsight", !hasSchedule ? "is-warning" : conflictCount > 0 ? "is-danger" : "is-good");
  setInsightState("nextMoveInsight", isSynced || (hasSchedule && conflictCount === 0) ? "is-good" : "is-warning");
  updateWorkflowSteps({
    hasGoal,
    hasPlan,
    hasSchedule,
    isSynced
  });
}

function updateWorkflowSteps({ hasGoal, hasPlan, hasSchedule, isSynced }) {
  const steps = [
    { id: "stepGoal", done: hasGoal, active: !hasGoal },
    { id: "stepPlan", done: hasPlan, active: hasGoal && !hasPlan },
    { id: "stepSchedule", done: hasSchedule, active: hasPlan && !hasSchedule },
    { id: "stepSync", done: isSynced, active: hasSchedule && !isSynced }
  ];
  steps.forEach(step => {
    const el = document.getElementById(step.id);
    if (!el) return;
    el.classList.toggle("is-done", step.done);
    el.classList.toggle("is-active", step.active);
  });
}


async function requireAuth() {
  try {
    const res = await fetch(`${BACKEND_BASE}/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) {
      window.location.href = "index.html";
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch (err) {
    console.error(err);
    window.location.href = "index.html";
    return null;
  }
}

function renderCalendarEvents(events) {
  const listEl = document.getElementById("eventsList");
  if (!events || events.length === 0) {
    listEl.innerHTML = `<div class="output-empty">No events found in the next 7 days.</div>`;
    return;
  }
  listEl.innerHTML = events.map(ev => `
    <div class="calendar-event-card">
      <div class="calendar-event-head">
        <h4 class="calendar-event-title">${escapeHtml(ev.summary || "(no title)")}</h4>
        <span class="tag">Calendar</span>
      </div>
      <div class="muted-text">
        ${escapeHtml(formatEventTime(ev.start))} -> ${escapeHtml(formatEventTime(ev.end))}
      </div>
    </div>
  `).join("");
}

async function loadEvents() {
  const statusEl = document.getElementById("eventsStatus");
  statusEl.textContent = "Loading events...";
  try {
    const res = await fetch(`${BACKEND_BASE}/api/v1/calendar/events`, {
      credentials: "include",
    });
    if (!res.ok) {
      const txt = await res.text();
      statusEl.textContent = "Error loading events: " + txt;
      return;
    }
    const data = await res.json();
    const events = data.events || [];
    window.currentCalendarEvents = events;
    if (events.length === 0) {
      statusEl.textContent = "No upcoming events found.";
      renderCalendarEvents([]);
      updateQuickStats();
      return;
    }
    statusEl.textContent = `Loaded ${events.length} event(s).`;
    renderCalendarEvents(events);
    updateQuickStats();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Network error while loading events.";
    updateQuickStats();
  }
}

async function logout() {
  try {
    await fetch(`${BACKEND_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error(err);
  }
  window.location.href = "index.html";
}

window.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  const userEl = document.getElementById("userInfo");
  if (userEl) {
    userEl.textContent = `Signed in as ${user.name || user.email}`;
  }
  const refreshBtn = document.getElementById("refreshEventsBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const goalInput = document.getElementById("goalInput");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadEvents);
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
  const hoursPerDayInput = document.getElementById("hoursPerDayInput");
  const daysPerWeekInput = document.getElementById("daysPerWeekInput");
  const dayTypeSelect = document.getElementById("dayTypeSelect");
  if (goalInput) {
    goalInput.addEventListener("input", updateQuickStats);
  }
  if (dayTypeSelect) {
    dayTypeSelect.addEventListener("change", () => {
      if (typeof syncPreferenceInputs === "function") {
        syncPreferenceInputs();
      }
      if (typeof normalizeDaysPerWeekInput === "function") {
        normalizeDaysPerWeekInput();
      }
      updateQuickStats();
    });
  }
  if (daysPerWeekInput) {
    daysPerWeekInput.addEventListener("change", () => {
      if (typeof normalizeDaysPerWeekInput === "function") {
        normalizeDaysPerWeekInput();
      }
      if (typeof syncPreferenceInputs === "function") {
        syncPreferenceInputs();
      }
      updateQuickStats();
    });
    daysPerWeekInput.addEventListener("input", () => {
      updateQuickStats();
    });
  }
  if (hoursPerDayInput) {
    hoursPerDayInput.addEventListener("change", () => {
      if (typeof normalizeHoursPerDayInput === "function") {
        normalizeHoursPerDayInput();
      }
      updateQuickStats();
    });
    hoursPerDayInput.addEventListener("input", () => {
      updateQuickStats();
    });
  }
  if (typeof syncPreferenceInputs === "function") {
    syncPreferenceInputs();
  }
  updateQuickStats();
  loadEvents();
  if (typeof loadHistory === "function") {
    loadHistory();
  }
});
