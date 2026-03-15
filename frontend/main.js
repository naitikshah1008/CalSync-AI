const BACKEND_BASE = "";

function formatEventTime(isoOrDate) {
  if (!isoOrDate) return "";
  return new Date(isoOrDate).toLocaleString();
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

async function loadEvents() {
  const statusEl = document.getElementById("eventsStatus");
  const listEl = document.getElementById("eventsList");
  statusEl.textContent = "Loading events...";
  listEl.innerHTML = "";
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
    if (events.length === 0) {
      statusEl.textContent = "No events found in the next 7 days.";
      return;
    }
    statusEl.textContent = `Loaded ${events.length} event(s).`;
    events.forEach((ev) => {
      const div = document.createElement("div");
      const summary = document.createElement("div");
      summary.textContent = ev.summary || "(no title)";
      const times = document.createElement("div");
      times.textContent = `${formatEventTime(ev.start)} → ${formatEventTime(ev.end)}`;
      div.appendChild(summary);
      div.appendChild(times);
      listEl.appendChild(div);
    });
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
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadEvents);
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
  loadEvents();
});
