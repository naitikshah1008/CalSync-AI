const API_BASE = "";

let learningPlan = null;
let schedule = null;
let savedLearningPlanId = null;
let savedScheduleId = null;
let loadedHistoryPlans = [];
let loadedHistorySchedules = [];

window.learningPlanState = [];
window.scheduleState = [];

const goalInput = document.getElementById("goalInput");
const planOutput = document.getElementById("planOutput");
const scheduleOutput = document.getElementById("scheduleOutput");
const generatePlanBtn = document.getElementById("generatePlanBtn");
const generateScheduleBtn = document.getElementById("generateScheduleBtn");
const approveBtn = document.getElementById("approveBtn");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");
const historyPlansList = document.getElementById("historyPlansList");
const historySchedulesList = document.getElementById("historySchedulesList");
const historyScheduleEventsList = document.getElementById("historyScheduleEventsList");

generatePlanBtn.addEventListener("click", async () => {
  const goal = goalInput.value.trim();
  if (!goal) {
    alert("Please enter a learning goal");
    return;
  }
  // Reset old generated schedule immediately when starting a new plan
  learningPlan = null;
  schedule = null;
  savedLearningPlanId = null;
  savedScheduleId = null;
  renderTopPlanMessage("Generating learning plan...");
  renderTopScheduleMessage("Generate a new schedule for this plan.");
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
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();
    let data = {};
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    } else {
      renderTopPlanMessage(`Error generating learning plan. Server returned ${res.status}.`);
      console.error("Non-JSON response:", rawText);
      return;
    }
    if (!res.ok) {
      renderTopPlanMessage("Error: " + (data.error || `Server returned ${res.status}`));
      return;
    }
    if (data.error) {
      renderTopPlanMessage("Error: " + data.error);
      return;
    }
    learningPlan = data.learning_plan;
    savedLearningPlanId = data.saved_learning_plan_id || null;
    renderTopLearningPlan(learningPlan);
    // Keep schedule cleared until user generates a new one for this new plan
    schedule = null;
    savedScheduleId = null;
    renderTopScheduleMessage("Generate a schedule for this learning plan.");
    approveBtn.disabled = true;
    generateScheduleBtn.disabled = false;
  } catch (err) {
    renderTopPlanMessage("Error generating learning plan.");
    renderTopScheduleMessage("Generate a schedule for this learning plan.");
    console.error(err);
  }
});

generateScheduleBtn.addEventListener("click", async () => {
  if (!learningPlan) return;
  renderTopScheduleMessage("Generating schedule...");
  approveBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/generate-schedule`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saved_learning_plan_id: savedLearningPlanId,
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
      renderTopScheduleMessage(`Error generating schedule. Server returned ${res.status}.`);
      return;
    }
    console.log("Schedule response:", data);
    if (!res.ok) {
      renderTopScheduleMessage("Error: " + (data.error || `Server returned ${res.status}`));
      return;
    }
    if (data.error) {
      renderTopScheduleMessage("Error: " + data.error);
      return;
    }
    if (!data.schedule || data.schedule.length === 0) {
      renderTopScheduleMessage("No schedule could be generated.");
      return;
    }
    schedule = data.schedule;
    savedScheduleId = data.saved_schedule_id || null;
    renderTopSchedule(schedule);
    approveBtn.disabled = false;
  } catch (err) {
    console.error(err);
    renderTopScheduleMessage("Error generating schedule.");
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
    loadedHistoryPlans = plansData.learning_plans || [];
    loadedHistorySchedules = schedulesData.schedules || [];
    renderLearningPlans(loadedHistoryPlans);
    renderSchedules(loadedHistorySchedules);
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

async function deleteLearningPlan(id) {
  const confirmed = window.confirm("Delete this saved learning plan?");
  if (!confirmed) return;
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/learning-plans/delete?id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();
    let data = {};
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    }
    if (!res.ok) {
      alert(data.error || `Failed to delete learning plan (${res.status})`);
      return;
    }
    loadHistory();
  } catch (err) {
    console.error(err);
    alert("Failed to delete learning plan.");
  }
}

async function deleteSchedule(id) {
  const confirmed = window.confirm(
    "Delete this saved schedule? If it was applied, its linked Google Calendar events will also be removed."
  );
  if (!confirmed) return;
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/schedules/delete?id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();
    let data = {};
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    }
    if (!res.ok) {
      alert(data.error || `Failed to delete schedule (${res.status})`);
      return;
    }
    alert(
      `Deleted schedule successfully.${typeof data.deleted_google_events === "number" ? ` Removed ${data.deleted_google_events} Google Calendar event(s).` : ""}`
    );
    if (typeof loadEvents === "function") {
      loadEvents();
    }
    loadHistory();
  } catch (err) {
    console.error(err);
    alert("Failed to delete schedule.");
  }
}

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
    const linkedSchedule = findScheduleForLearningPlan(plan.id, loadedHistorySchedules);
    return `
      <div class="card">
        <h4>${plan.goal || "Untitled Goal"}</h4>
        <div class="meta">
          Created: ${formatDateTime(plan.created_at)}<br>
          Total Hours: ${plan.total_hours ?? "-"}<br>
          Topics: ${topics.length}
        </div>
        <div class="action-row">
          <button class="small-btn" onclick="toggleDetails('${detailsId}')">Show Details</button>
          <button class="small-btn delete-btn" onclick="deleteLearningPlan(${plan.id})">Delete</button>
        </div>
        <div class="details" id="${detailsId}">
          ${topics.map(topic => `
            • ${topic.topic} (${topic.difficulty_rating || "unknown"}, ${topic.estimated_hours || 0}h)
              - ${topic.subtopics?.join(", ") || ""}
          `).join("\n")}
          <div class="action-row" style="margin-top: 12px;">
            ${
              linkedSchedule
                ? `<button class="small-btn" onclick="jumpToSavedSchedule(${linkedSchedule.id})">Open Saved Schedule</button>`
                : `<button class="small-btn" onclick="generateScheduleFromSavedPlan(${plan.id})">Generate Schedule</button>`
            }
          </div>
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
  historySchedulesList.innerHTML = schedules.slice(0, 5).map((scheduleItem) => {
    const sessions = scheduleItem.schedule?.schedule || [];
    const detailsId = `saved-schedule-details-${scheduleItem.id}`;
    const cardId = `saved-schedule-card-${scheduleItem.id}`;
    const statusClass = scheduleItem.status === "applied" ? "applied" : "draft";
    return `
      <div class="card" id="${cardId}">
        <h4>Schedule #${scheduleItem.id}</h4>
        <div class="meta">
          <span class="chip ${statusClass}">${scheduleItem.status || "unknown"}</span>
          Created: ${formatDateTime(scheduleItem.created_at)}<br>
          ${scheduleItem.applied_at ? `Applied: ${formatDateTime(scheduleItem.applied_at)}<br>` : "Not applied yet<br>"}
          Sessions: ${sessions.length}
        </div>
        <div class="action-row">
          <button class="small-btn" onclick="toggleDetails('${detailsId}')">Show Sessions</button>
          <button class="small-btn delete-btn" onclick="deleteSchedule(${scheduleItem.id})">Delete</button>
        </div>
        <div class="details" id="${detailsId}">
          ${sessions.map(session => `
            • ${session.topic} - Session ${session.session_number}
              ${formatDateTime(session.start)} -> ${formatDateTime(session.end)}
              Subtopics: ${session.subtopics?.join(", ") || ""}
          `).join("\n\n")}
          <div class="action-row" style="margin-top: 12px;">
            ${
              scheduleItem.status === "applied"
                ? `<button class="small-btn" disabled>Already Applied</button>`
                : `<button class="small-btn" onclick="applySavedSchedule(${scheduleItem.id})">Apply Schedule</button>`
            }
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function generateScheduleFromSavedPlan(planId) {
  const selectedPlan = loadedHistoryPlans.find(p => Number(p.id) === Number(planId));
  if (!selectedPlan) {
    alert("Saved learning plan not found.");
    return;
  }
  const extractedPlan = selectedPlan.plan?.learning_plan || [];
  if (!Array.isArray(extractedPlan) || extractedPlan.length === 0) {
    alert("This saved learning plan has no topics.");
    return;
  }
  learningPlan = extractedPlan;
  savedLearningPlanId = selectedPlan.id;
  savedScheduleId = null;
  schedule = null;
  goalInput.value = selectedPlan.goal || "";
  renderTopLearningPlan(learningPlan);
  renderTopScheduleMessage("Generating schedule...");
  approveBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/generate-schedule`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saved_learning_plan_id: savedLearningPlanId,
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
    let data = {};
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    } else {
      renderTopScheduleMessage(`Error generating schedule. Server returned ${res.status}.`);
      console.error("Non-JSON response:", rawText);
      return;
    }
    if (!res.ok) {
      renderTopScheduleMessage("Error: " + (data.error || `Server returned ${res.status}`));
      return;
    }
    if (data.error) {
      renderTopScheduleMessage("Error: " + data.error);
      return;
    }
    schedule = data.schedule;
    savedScheduleId = data.saved_schedule_id || null;
    renderTopSchedule(schedule);
    approveBtn.disabled = false;
    const plannerSection = document.getElementById("plannerSection");
    if (plannerSection) {
      plannerSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    await loadHistory();
  } catch (err) {
    console.error(err);
    renderTopScheduleMessage("Error generating schedule.");
  }
}

async function applySavedSchedule(scheduleId) {
  const selectedSchedule = findScheduleById(scheduleId, loadedHistorySchedules);
  if (!selectedSchedule) {
    alert("Saved schedule not found.");
    return;
  }
  schedule = selectedSchedule.schedule?.schedule || [];
  savedScheduleId = selectedSchedule.id;
  savedLearningPlanId = selectedSchedule.learning_plan_id || null;
  renderTopSchedule(schedule);
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
      await loadHistory();
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
    await loadHistory();
  } catch (err) {
    alert("Network error while applying schedule");
    console.error(err);
  }
}

function renderScheduleEvents(events) {
  if (!events || events.length === 0) {
    historyScheduleEventsList.textContent = "No currently active applied calendar events.";
    return;
  }
  historyScheduleEventsList.innerHTML = `
    <div class="card">
      ${events.slice(0, 10).map(event => `
        <div class="event-row">
          <strong>${event.title}</strong><br>
          <span class="meta">
            ${formatDateTime(event.start_time)} -> ${formatDateTime(event.end_time)}<br>
            Schedule ID: ${event.schedule_id}
          </span>
          ${event.html_link ? `<br><a class="event-link" href="${event.html_link}" target="_blank">Open in Google Calendar</a>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function findScheduleForLearningPlan(planId, schedules) {
  if (!planId || !Array.isArray(schedules)) return null;
  return schedules.find(s => Number(s.learning_plan_id) === Number(planId)) || null;
}

function findScheduleById(scheduleId, schedules) {
  if (!scheduleId || !Array.isArray(schedules)) return null;
  return schedules.find(s => Number(s.id) === Number(scheduleId)) || null;
}

function jumpToSavedSchedule(scheduleId) {
  const selectedSchedule = findScheduleById(scheduleId, loadedHistorySchedules);
  if (!selectedSchedule) {
    alert("Saved schedule not found.");
    return;
  }
  // Explicitly clear the top planner area
  schedule = null;
  savedScheduleId = null;
  approveBtn.disabled = true;
  renderTopScheduleMessage("Open the schedule from the Saved Schedules section below.");
  // Close any other open schedule details first
  document.querySelectorAll('[id^="saved-schedule-details-"]').forEach(el => {
    el.classList.remove("open");
  });
  // Open the matching saved schedule card below
  const detailsEl = document.getElementById(`saved-schedule-details-${scheduleId}`);
  const cardEl = document.getElementById(`saved-schedule-card-${scheduleId}`);
  if (detailsEl) {
    detailsEl.classList.add("open");
  }
  if (cardEl) {
    cardEl.classList.add("highlight-card");
    cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      cardEl.classList.remove("highlight-card");
    }, 2000);
  }
}

function renderTopLearningPlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) {
    planOutput.innerHTML = `<div class="output-empty">No plan yet.</div>`;
    window.learningPlanState = [];
    if (typeof updateQuickStats === "function") updateQuickStats();
    return;
  }
  window.learningPlanState = plan;
  planOutput.innerHTML = plan.map(topic => `
    <div class="plan-topic-card">
      <div class="plan-topic-head">
        <div>
          <h4 class="plan-topic-title">${topic.topic || "Untitled Topic"}</h4>
          <div class="muted-text">${topic.description || "No description provided."}</div>
        </div>
        <div class="action-row" style="justify-content: flex-end;">
          <span class="chip">${topic.difficulty_rating || "unknown"}</span>
          <span class="chip">${topic.estimated_hours || 0}h</span>
        </div>
      </div>
      <div class="topic-subtopics">
        ${(topic.subtopics || []).map(sub => `<span class="tag">${sub}</span>`).join("")}
      </div>
    </div>
  `).join("");
  if (typeof updateQuickStats === "function") updateQuickStats();
}

function renderTopSchedule(scheduleItems) {
  if (!Array.isArray(scheduleItems) || scheduleItems.length === 0) {
    scheduleOutput.innerHTML = `<div class="output-empty">No schedule yet.</div>`;
    window.scheduleState = [];
    if (typeof updateQuickStats === "function") updateQuickStats();
    return;
  }
  window.scheduleState = scheduleItems;
  scheduleOutput.innerHTML = scheduleItems.map(session => `
    <div class="schedule-session-card">
      <div class="schedule-session-head">
        <div>
          <h4 class="schedule-session-title">${session.topic || "Untitled Topic"} - Session ${session.session_number ?? "-"}</h4>
          <div class="muted-text">
            ${formatDateTime(session.start)} -> ${formatDateTime(session.end)}
          </div>
        </div>
      </div>
      <div class="session-subtopics">
        ${(session.subtopics || []).map(sub => `<span class="tag">${sub}</span>`).join("")}
      </div>
    </div>
  `).join("");
  if (typeof updateQuickStats === "function") updateQuickStats();
}

function renderTopPlanMessage(message) {
  planOutput.innerHTML = `<div class="output-empty">${message}</div>`;
  window.learningPlanState = [];
  if (typeof updateQuickStats === "function") updateQuickStats();
}

function renderTopScheduleMessage(message) {
  scheduleOutput.innerHTML = `<div class="output-empty">${message}</div>`;
  window.scheduleState = [];
  if (typeof updateQuickStats === "function") updateQuickStats();
}

window.toggleDetails = toggleDetails;
window.deleteLearningPlan = deleteLearningPlan;
window.deleteSchedule = deleteSchedule;
window.generateScheduleFromSavedPlan = generateScheduleFromSavedPlan;
window.jumpToSavedSchedule = jumpToSavedSchedule;
window.applySavedSchedule = applySavedSchedule;
