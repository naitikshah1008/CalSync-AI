const BACKEND_BASE = "http://localhost:8080";

// -------- Helpers --------
function formatEventTime(isoOrDate) {
  if (!isoOrDate) return "";
  // For simple display only
  return new Date(isoOrDate).toLocaleString();
}

// Convert value like "2025-12-02T10:00" -> "2025-12-02T10:00:00"
function toRFC3339FromLocal(datetimeLocalValue) {
  if (!datetimeLocalValue) return "";
  if (datetimeLocalValue.length === 16) {
    // "YYYY-MM-DDTHH:MM"
    return datetimeLocalValue + ":00";
  }
  return datetimeLocalValue; // if browser gives seconds already
}

// -------- Load events (GET /api/v1/calendar/events) --------
async function loadEvents() {
  const statusEl = document.getElementById("eventsStatus");
  const listEl = document.getElementById("eventsList");

  statusEl.textContent = "Loading events...";
  listEl.innerHTML = "";

  try {
    const res = await fetch(`${BACKEND_BASE}/api/v1/calendar/events`);
    if (!res.ok) {
      const txt = await res.text();
      statusEl.textContent = "Error loading events: " + txt;
      return;
    }

    const data = await res.json();
    const events = data.events || [];

    if (events.length === 0) {
      statusEl.textContent = "No events found in the next 7 days.";
      return;
    }

    statusEl.textContent = `Loaded ${events.length} event(s).`;

    events.forEach(ev => {
      const div = document.createElement("div");
      div.className = "event-item";

      const summary = document.createElement("div");
      summary.className = "event-summary";
      summary.textContent = ev.summary || "(no title)";

      const times = document.createElement("div");
      times.textContent = `${ev.start} → ${ev.end}`;

      div.appendChild(summary);
      div.appendChild(times);
      listEl.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    statusEl.textContent = "Network error while loading events.";
  }
}

// -------- Create event (POST /api/v1/calendar/events/create) --------
async function createEvent() {
  const summaryEl = document.getElementById("eventSummary");
  const descEl = document.getElementById("eventDescription");
  const startEl = document.getElementById("eventStart");
  const endEl = document.getElementById("eventEnd");
  const statusEl = document.getElementById("createStatus");

  const summary = summaryEl.value.trim();
  const description = descEl.value.trim();
  const startLocal = startEl.value;
  const endLocal = endEl.value;

  if (!summary || !startLocal || !endLocal) {
    statusEl.textContent = "Summary, start, and end are required.";
    return;
  }

  const startRFC3339 = toRFC3339FromLocal(startLocal);
  const endRFC3339 = toRFC3339FromLocal(endLocal);

  const payload = {
    summary,
    description,
    start: startRFC3339,
    end: endRFC3339,
  };

  statusEl.textContent = "Creating event...";

  try {
    const res = await fetch(`${BACKEND_BASE}/api/v1/calendar/events/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      statusEl.textContent = "Error creating event: " + txt;
      return;
    }

    const data = await res.json();
    statusEl.textContent = `Event created! (ID: ${data.event_id || "unknown"})`;

    // Optionally clear inputs
    // summaryEl.value = "";
    // descEl.value = "";
    // startEl.value = "";
    // endEl.value = "";

    // Refresh events list so user sees it
    loadEvents();

  } catch (err) {
    console.error(err);
    statusEl.textContent = "Network error while creating event.";
  }
}

// -------- Wire up events on page load --------
window.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshEventsBtn");
  const createBtn = document.getElementById("createEventBtn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadEvents);
  }

  if (createBtn) {
    createBtn.addEventListener("click", createEvent);
  }

  // Auto-load events when page opens
  loadEvents();
});
