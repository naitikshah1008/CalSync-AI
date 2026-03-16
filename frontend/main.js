const BACKEND_BASE = "";

window.currentCalendarEvents = [];

function formatEventTime(isoOrDate) {
  if (!isoOrDate) return "";
  return new Date(isoOrDate).toLocaleString();
}

function updateQuickStats() {
  const statGoal = document.getElementById("statGoal");
  const statTopics = document.getElementById("statTopics");
  const statSessions = document.getElementById("statSessions");
  const statHoursPerDay = document.getElementById("statHoursPerDay");
  const statDaysPerWeek = document.getElementById("statDaysPerWeek");
  const statDayType = document.getElementById("statDayType");
  const goalInput = document.getElementById("goalInput");
  const hoursPerDayInput = document.getElementById("hoursPerDayInput");
  const daysPerWeekInput = document.getElementById("daysPerWeekInput");
  const dayTypeSelect = document.getElementById("dayTypeSelect");
  if (statGoal) {
    const goal = (goalInput?.value || "").trim();
    statGoal.textContent = goal || "—";
  }
  if (statTopics) {
    const topicsCount = Array.isArray(window.learningPlanState) ? window.learningPlanState.length : 0;
    statTopics.textContent = String(topicsCount);
  }
  if (statSessions) {
    const sessionsCount = Array.isArray(window.scheduleState) ? window.scheduleState.length : 0;
    statSessions.textContent = String(sessionsCount);
  }
    if (statHoursPerDay) {
    statHoursPerDay.textContent = hoursPerDayInput?.value || "-";
  }
  if (statDaysPerWeek) {
    statDaysPerWeek.textContent = daysPerWeekInput?.value || "-";
  }
  if (statDayType) {
    const raw = dayTypeSelect?.value || "";
    statDayType.textContent =
      raw === "weekdays" ? "Weekdays" :
      raw === "weekends" ? "Weekends" :
      raw === "both" ? "Both" :
      "-";
  }
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
        <h4 class="calendar-event-title">${ev.summary || "(no title)"}</h4>
        <span class="tag">Calendar</span>
      </div>
      <div class="muted-text">
        ${formatEventTime(ev.start)} -> ${formatEventTime(ev.end)}
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
      return;
    }
    statusEl.textContent = `Loaded ${events.length} event(s).`;
    renderCalendarEvents(events);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Network error while loading events.";
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
  if (goalInput) {
    goalInput.addEventListener("input", updateQuickStats);
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
    daysPerWeekInput.addEventListener("input", () => {
      if (typeof normalizeDaysPerWeekInput === "function") {
        normalizeDaysPerWeekInput();
      }
      if (typeof syncPreferenceInputs === "function") {
        syncPreferenceInputs();
      }
      updateQuickStats();
    });
  }
  if (hoursPerDayInput) {
    hoursPerDayInput.addEventListener("input", updateQuickStats);
  }
  if (typeof syncPreferenceInputs === "function") {
    syncPreferenceInputs();
  }
  updateQuickStats();
  loadEvents();
});
