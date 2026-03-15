const API_BASE = "";

let learningPlan = null;
let schedule = null;
let savedScheduleId = null;

const goalInput = document.getElementById("goalInput");
const planOutput = document.getElementById("planOutput");
const scheduleOutput = document.getElementById("scheduleOutput");
const generatePlanBtn = document.getElementById("generatePlanBtn");
const generateScheduleBtn = document.getElementById("generateScheduleBtn");
const approveBtn = document.getElementById("approveBtn");

generatePlanBtn.addEventListener("click", async () => {
  const goal = goalInput.value.trim();
  if (!goal) {
    alert("Please enter a learning goal");
    return;
  }
  planOutput.textContent = "Generating learning plan...";
  generateScheduleBtn.disabled = true;
  approveBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/generate-learning-plan`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal,
        total_hours: 10
      })
    });
    const data = await res.json();
    if (data.error) {
      planOutput.textContent = "Error: " + data.error;
      return;
    }
    learningPlan = data.learning_plan;
    planOutput.textContent = JSON.stringify(learningPlan, null, 2);
    generateScheduleBtn.disabled = false;
  } catch (err) {
    planOutput.textContent = "Error generating learning plan";
    console.error(err);
  }
});

generateScheduleBtn.addEventListener("click", async () => {
  if (!learningPlan) return;
  scheduleOutput.textContent = "Generating schedule...";
  approveBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/generate-schedule`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learning_plan: learningPlan,
        preferences: {
          start_hour: 18,
          end_hour: 22,
          session_length_minutes: 90,
          days_per_week: 4
        }
      })
    });
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();
    let data = null;
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    } else {
      console.error("Non-JSON response:", rawText);
      scheduleOutput.textContent = `Error generating schedule. Server returned ${res.status}.`;
      return;
    }
    console.log("Schedule response:", data);
    if (!res.ok) {
      scheduleOutput.textContent = "Error: " + (data.error || `Server returned ${res.status}`);
      return;
    }
    if (data.error) {
      scheduleOutput.textContent = "Error: " + data.error;
      return;
    }
    if (!data.schedule || data.schedule.length === 0) {
      scheduleOutput.textContent = "No schedule could be generated.";
      return;
    }
    schedule = data.schedule;
    savedScheduleId = data.saved_schedule_id || null;
    scheduleOutput.textContent = JSON.stringify(schedule, null, 2);
    approveBtn.disabled = false;
  } catch (err) {
    console.error(err);
    scheduleOutput.textContent = "Error generating schedule.";
  }
});

approveBtn.addEventListener("click", async () => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/apply-schedule`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saved_schedule_id: savedScheduleId,
        schedule: schedule,
        apply: true
      })
    });
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();
    let data = {};
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    } else {
      alert(`Failed to add events. Server returned ${res.status}.`);
      console.error("Non-JSON response:", rawText);
      return;
    }
    if (res.status === 409) {
      alert(data.error || "This schedule has already been applied.");
      approveBtn.disabled = true;
      if (typeof loadHistory === "function") {
        loadHistory();
      }
      return;
    }
    if (!res.ok) {
      alert("Failed to add events: " + (data.error || `Server returned ${res.status}`));
      return;
    }
    if (data.error) {
      alert("Failed to add events: " + data.error);
      return;
    }
    alert(`Created ${data.events_created?.length || 0} events`);
    approveBtn.disabled = true;
    if (typeof loadEvents === "function") {
      loadEvents();
    }
    if (typeof loadHistory === "function") {
      loadHistory();
    }
  } catch (err) {
    alert("Network error while applying schedule");
    console.error(err);
  }
});

const loadHistoryBtn = document.getElementById("loadHistoryBtn");
const historyPlansOutput = document.getElementById("historyPlansOutput");
const historySchedulesOutput = document.getElementById("historySchedulesOutput");
const historyScheduleEventsOutput = document.getElementById("historyScheduleEventsOutput");

async function loadHistory() {
  try {
    const [plansRes, schedulesRes, scheduleEventsRes] = await Promise.all([
      fetch(`${API_BASE}/api/v1/ai/learning-plans`, {
        credentials: "include",
      }),
      fetch(`${API_BASE}/api/v1/ai/schedules`, {
        credentials: "include",
      }),
      fetch(`${API_BASE}/api/v1/ai/schedule-events`, {
        credentials: "include",
      }),
    ]);
    const plansData = await plansRes.json();
    const schedulesData = await schedulesRes.json();
    const scheduleEventsData = await scheduleEventsRes.json();
    renderLearningPlans(plansData.learning_plans || []);
    renderSchedules(schedulesData.schedules || []);
    renderScheduleEvents(scheduleEventsData.schedule_events || []);
  } catch (err) {
    console.error(err);
    historyPlansList.textContent = "Failed to load saved plans.";
    historySchedulesList.textContent = "Failed to load saved schedules.";
    historyScheduleEventsList.textContent = "Failed to load applied schedule events.";
  }
}

if (loadHistoryBtn) {
  loadHistoryBtn.addEventListener("click", loadHistory);
}

const historyPlansList = document.getElementById("historyPlansList");
const historySchedulesList = document.getElementById("historySchedulesList");
const historyScheduleEventsList = document.getElementById("historyScheduleEventsList");

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function toggleDetails(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.toggle("open");
  }
}

function renderLearningPlans(plans) {
  if (!plans || plans.length === 0) {
    historyPlansList.textContent = "No saved learning plans.";
    return;
  }
  historyPlansList.innerHTML = plans.slice(0, 5).map((plan, index) => {
    const topics = plan.plan?.learning_plan || [];
    const detailsId = `plan-details-${index}`;
    return `
      <div class="card">
        <h4>${plan.goal || "Untitled Goal"}</h4>
        <div class="meta">
          Created: ${formatDateTime(plan.created_at)}<br>
          Total Hours: ${plan.total_hours ?? "—"}<br>
          Topics: ${topics.length}
        </div>
        <button class="small-btn" onclick="toggleDetails('${detailsId}')">Show Details</button>
        <div class="details" id="${detailsId}">
          ${topics.map(topic => `
            • ${topic.topic} (${topic.difficulty_rating || "unknown"}, ${topic.estimated_hours || 0}h)
              - ${topic.subtopics?.join(", ") || ""}
          `).join("\n")}
        </div>
      </div>
    `;
  }).join("");
}

function renderSchedules(schedules) {
  if (!schedules || schedules.length === 0) {
    historySchedulesList.textContent = "No saved schedules.";
    return;
  }
  historySchedulesList.innerHTML = schedules.slice(0, 5).map((scheduleItem, index) => {
    const sessions = scheduleItem.schedule?.schedule || [];
    const detailsId = `schedule-details-${index}`;
    const statusClass = scheduleItem.status === "applied" ? "applied" : "draft";
    return `
      <div class="card">
        <h4>Schedule #${scheduleItem.id}</h4>
        <div class="meta">
          <span class="chip ${statusClass}">${scheduleItem.status || "unknown"}</span>
          Created: ${formatDateTime(scheduleItem.created_at)}<br>
          ${scheduleItem.applied_at ? `Applied: ${formatDateTime(scheduleItem.applied_at)}<br>` : "Not applied yet<br>"}
          Sessions: ${sessions.length}
        </div>
        <button class="small-btn" onclick="toggleDetails('${detailsId}')">Show Sessions</button>
        <div class="details" id="${detailsId}">
          ${sessions.map(session => `
            • ${session.topic} — Session ${session.session_number}
              ${formatDateTime(session.start)} → ${formatDateTime(session.end)}
              Subtopics: ${session.subtopics?.join(", ") || ""}
          `).join("\n\n")}
        </div>
      </div>
    `;
  }).join("");
}

function renderScheduleEvents(events) {
  if (!events || events.length === 0) {
    historyScheduleEventsList.textContent = "No applied calendar events.";
    return;
  }
  historyScheduleEventsList.innerHTML = `
    <div class="card">
      ${events.slice(0, 10).map(event => `
        <div class="event-row">
          <strong>${event.title}</strong><br>
          <span class="meta">
            ${formatDateTime(event.start_time)} → ${formatDateTime(event.end_time)}<br>
            Schedule ID: ${event.schedule_id}
          </span>
          ${event.html_link ? `<br><a class="event-link" href="${event.html_link}" target="_blank">Open in Google Calendar</a>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

window.toggleDetails = toggleDetails;
