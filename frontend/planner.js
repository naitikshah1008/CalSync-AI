const API_BASE = "";

let learningPlan = null;
let schedule = null;
let savedLearningPlanId = null;
let savedScheduleId = null;
let loadedHistoryPlans = [];
let loadedHistorySchedules = [];
let scheduleDrafts = {};
let savedScheduleDrafts = {};
let savedScheduleDirtyFlags = {};
let historyGeneratingPlanId = null;
let scheduleLocked = false;
let learningPlanLocked = false;
let learningPlanSaved = false;
let scheduleSaved = false;
let generatedGoalText = "";
let generatedPlanTotalHours = 10;

window.learningPlanState = [];
window.scheduleState = [];

const goalInput = document.getElementById("goalInput");
const hoursPerDayInput = document.getElementById("hoursPerDayInput");
const daysPerWeekInput = document.getElementById("daysPerWeekInput");
const dayTypeSelect = document.getElementById("dayTypeSelect");
const planOutput = document.getElementById("planOutput");
const scheduleOutput = document.getElementById("scheduleOutput");
const generatePlanBtn = document.getElementById("generatePlanBtn");
const generateScheduleBtn = document.getElementById("generateScheduleBtn");
const approveBtn = document.getElementById("approveBtn");
const deleteAppliedBtn = document.getElementById("deleteAppliedBtn");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");
const historyPlansList = document.getElementById("historyPlansList");
const historySchedulesList = document.getElementById("historySchedulesList");
const historyScheduleEventsList = document.getElementById("historyScheduleEventsList");
const topSaveLearningPlanBtn = document.getElementById("topSaveLearningPlanBtn");
const topSaveScheduleBtn = document.getElementById("topSaveScheduleBtn");

generatePlanBtn.addEventListener("click", async () => {
  const goal = goalInput.value.trim();
  if (!goal) {
    alert("Please enter a learning goal");
    return;
  }
  generatePlanBtn.disabled = true;
  generateScheduleBtn.disabled = true;
  setInputsDisabled({ goal: true });
  // Reset old generated schedule immediately when starting a new plan
  learningPlan = null;
  schedule = null;
  savedLearningPlanId = null;
  savedScheduleId = null;
  learningPlanSaved = false;
  scheduleSaved = false;
  learningPlanLocked = false;
  scheduleLocked = false;
  if (deleteAppliedBtn) {
    deleteAppliedBtn.disabled = true;
  }
  generatedGoalText = goal;
  generatedPlanTotalHours = 10;
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
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = !learningPlan;
      setInputsDisabled({ goal: false });
      renderTopPlanMessage(`Error generating learning plan. Server returned ${res.status}.`);
      console.error("Non-JSON response:", rawText);
      return;
    }
    if (!res.ok) {
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = !learningPlan;
      setInputsDisabled({ goal: false });
      renderTopPlanMessage("Error: " + (data.error || `Server returned ${res.status}`));
      return;
    }
    if (data.error) {
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = !learningPlan;
      setInputsDisabled({ goal: false });
      renderTopPlanMessage("Error: " + data.error);
      return;
    }
    learningPlan = data.learning_plan;
    setInputsDisabled({ goal: false });
    savedLearningPlanId = null;
    savedScheduleId = null;
    learningPlanSaved = false;
    scheduleSaved = false;
    learningPlanLocked = false;
    scheduleLocked = false;
    renderTopLearningPlan(learningPlan);
    // Keep schedule cleared until user generates a new one for this new plan
    schedule = null;
    savedScheduleId = null;
    renderTopScheduleMessage("Generate a schedule for this learning plan.");
    approveBtn.disabled = true;
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
  } catch (err) {
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = !learningPlan;
    setInputsDisabled({ goal: false });
    renderTopPlanMessage("Error generating learning plan.");
    renderTopScheduleMessage("Generate a new schedule for this learning plan.");
    console.error(err);
  }
});

function setInputsDisabled({ goal = false, preferences = false } = {}) {
  if (goalInput) goalInput.disabled = goal;
  if (dayTypeSelect) dayTypeSelect.disabled = preferences;
  if (daysPerWeekInput) daysPerWeekInput.disabled = preferences;
  if (hoursPerDayInput) hoursPerDayInput.disabled = preferences;
}

function setAppliedScheduleUI(isApplied) {
  if (approveBtn) {
    approveBtn.disabled = isApplied;
  }
  if (deleteAppliedBtn) {
    deleteAppliedBtn.disabled = !isApplied;
  }
  scheduleLocked = isApplied;
  learningPlanLocked = isApplied;
  if (!isApplied) {
    setInputsDisabled({
      goal: true,
      preferences: false
    });
  }
  if (Array.isArray(learningPlan)) {
    renderTopLearningPlan(learningPlan);
  }
  if (Array.isArray(schedule)) {
    renderTopSchedule(schedule);
  }
}

function syncDaysPerWeekInput() {
  const dayType = dayTypeSelect?.value || "both";
  if (!daysPerWeekInput) return;
  if (dayType === "weekends") {
    daysPerWeekInput.value = 2;
    daysPerWeekInput.max = 2;
    daysPerWeekInput.min = 1;
    daysPerWeekInput.disabled = true;
  } else if (dayType === "weekdays") {
    daysPerWeekInput.disabled = false;
    daysPerWeekInput.max = 5;
    daysPerWeekInput.min = 1;
    if (Number(daysPerWeekInput.value) > 5) {
      daysPerWeekInput.value = 5;
    }
    if (Number(daysPerWeekInput.value) < 1) {
      daysPerWeekInput.value = 1;
    }
  } else {
    daysPerWeekInput.disabled = false;
    daysPerWeekInput.max = 7;
    daysPerWeekInput.min = 1;
    if (Number(daysPerWeekInput.value) > 7) {
      daysPerWeekInput.value = 7;
    }
    if (Number(daysPerWeekInput.value) < 1) {
      daysPerWeekInput.value = 1;
    }
  }
}

function syncPreferenceInputs() {
  const dayType = dayTypeSelect?.value || "";
  if (!daysPerWeekInput || !hoursPerDayInput) return;
  // Step 1: Study days must be chosen first
  if (!dayType) {
    daysPerWeekInput.disabled = true;
    daysPerWeekInput.value = "";
    daysPerWeekInput.placeholder = "Select study days first";
    hoursPerDayInput.disabled = true;
    hoursPerDayInput.value = "";
    hoursPerDayInput.placeholder = "Select days per week first";
    return;
  }
  // Step 2: Configure Days per week based on study-day choice
  daysPerWeekInput.disabled = false;
  if (dayType === "weekends") {
    daysPerWeekInput.min = 1;
    daysPerWeekInput.max = 2;
    daysPerWeekInput.value = 2;
    daysPerWeekInput.disabled = true;
  } else if (dayType === "weekdays") {
    daysPerWeekInput.min = 1;
    daysPerWeekInput.max = 5;
    if (!daysPerWeekInput.value || Number(daysPerWeekInput.value) > 5) {
      daysPerWeekInput.value = 5;
    }
    if (Number(daysPerWeekInput.value) < 1) {
      daysPerWeekInput.value = 1;
    }
  } else {
    daysPerWeekInput.min = 1;
    daysPerWeekInput.max = 7;
    if (!daysPerWeekInput.value || Number(daysPerWeekInput.value) > 7) {
      daysPerWeekInput.value = 4;
    }
    if (Number(daysPerWeekInput.value) < 1) {
      daysPerWeekInput.value = 1;
    }
  }
  // Step 3: Hours per day only unlocks after Days per week exists
  if (!daysPerWeekInput.value) {
    hoursPerDayInput.disabled = true;
    hoursPerDayInput.value = "";
    hoursPerDayInput.placeholder = "Select days per week first";
  } else {
    hoursPerDayInput.disabled = false;
    if (!hoursPerDayInput.value) {
      hoursPerDayInput.value = 1.5;
    }
  }
}

function normalizeDaysPerWeekInput() {
  if (!daysPerWeekInput || daysPerWeekInput.disabled) return;
  const max = Number(daysPerWeekInput.max || 7);
  const min = Number(daysPerWeekInput.min || 1);
  let value = Number(daysPerWeekInput.value || min);
  if (Number.isNaN(value)) value = min;
  if (value < min) value = min;
  if (value > max) value = max;
  daysPerWeekInput.value = value;
}

function getSchedulePreferences() {
  const dayType = dayTypeSelect?.value || "";
  const daysPerWeek = Number(daysPerWeekInput?.value || 0);
  const hoursPerDay = Number(hoursPerDayInput?.value || 0);
  let startHour = 18;
  let endHour = 18 + Math.max(1, Math.round(hoursPerDay || 1.5));
  if (endHour > 23) {
    endHour = 23;
  }
  return {
    start_hour: startHour,
    end_hour: endHour,
    session_length_minutes: Math.round((hoursPerDay || 1.5) * 60),
    days_per_week: daysPerWeek || 1,
    day_type: dayType || "both"
  };
}

function getSavedScheduleDraft(scheduleId) {
  if (!savedScheduleDrafts[scheduleId]) {
    const original = findScheduleById(scheduleId, loadedHistorySchedules);
    if (!original) return null;
    savedScheduleDrafts[scheduleId] = JSON.parse(
      JSON.stringify(original.schedule?.schedule || [])
    );
  }
  return savedScheduleDrafts[scheduleId];
}

function updateSavedScheduleField(scheduleId, index, field, value) {
  const original = findScheduleById(scheduleId, loadedHistorySchedules);
  if (original?.status === "applied") return;
  const draft = getSavedScheduleDraft(scheduleId);
  if (!draft || !draft[index]) return;
  draft[index][field] = value;
  savedScheduleDirtyFlags[scheduleId] = true;
  renderSchedules(loadedHistorySchedules);
}

function updateSavedScheduleSubtopics(scheduleId, index, value) {
  const original = findScheduleById(scheduleId, loadedHistorySchedules);
  if (original?.status === "applied") return;
  const draft = getSavedScheduleDraft(scheduleId);
  if (!draft || !draft[index]) return;
  draft[index].subtopics = value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  savedScheduleDirtyFlags[scheduleId] = true;
  renderSchedules(loadedHistorySchedules);
}

function updateSavedScheduleDateTime(scheduleId, index, part, value) {
  const original = findScheduleById(scheduleId, loadedHistorySchedules);
  if (original?.status === "applied") return;
  const draft = getSavedScheduleDraft(scheduleId);
  if (!draft || !draft[index]) return;
  const currentStart = new Date(draft[index].start);
  const currentEnd = new Date(draft[index].end);
  if (isNaN(currentStart) || isNaN(currentEnd)) return;
  let startDate = new Date(currentStart);
  let endDate = new Date(currentEnd);
  if (part === "date") {
    const [y, m, d] = value.split("-").map(Number);
    startDate.setFullYear(y, m - 1, d);
    endDate.setFullYear(y, m - 1, d);
  }
  if (part === "start") {
    const [h, min] = value.split(":").map(Number);
    startDate.setHours(h, min, 0, 0);
  }
  if (part === "end") {
    const [h, min] = value.split(":").map(Number);
    endDate.setHours(h, min, 0, 0);
  }
  if (endDate <= startDate) {
    alert("End time must be after start time.");
    return;
  }
  draft[index].start = startDate.toISOString();
  draft[index].end = endDate.toISOString();
  savedScheduleDirtyFlags[scheduleId] = true;
  renderSchedules(loadedHistorySchedules);
}

function deleteSavedScheduleSession(scheduleId, index) {
  const original = findScheduleById(scheduleId, loadedHistorySchedules);
  if (original?.status === "applied") return;
  const draft = getSavedScheduleDraft(scheduleId);
  if (!draft || !draft[index]) return;
  draft.splice(index, 1);
  savedScheduleDirtyFlags[scheduleId] = true;
  renderSchedules(loadedHistorySchedules);
}

async function applyEditedSavedSchedule(scheduleId) {
  const draft = getSavedScheduleDraft(scheduleId);
  const original = findScheduleById(scheduleId, loadedHistorySchedules);
  if (original?.status === "applied") {
    alert("Applied schedules cannot be edited or applied again.");
    return;
  }
  if (!draft || !original) {
    alert("Unable to find saved schedule.");
    return;
  }
  const button = document.getElementById(`apply-saved-schedule-btn-${scheduleId}`);
  if (button) {
    button.disabled = true;
  }
  try {
    if (typeof loadEvents === "function") {
      await loadEvents();
    }
    for (let i = 0; i < draft.length; i++) {
      const session = draft[i];
      const conflict = hasCalendarConflictOnly(session.start, session.end);
      if (conflict) {
        if (button) button.disabled = false;
        alert(`Cannot apply schedule. Session "${session.topic}" clashes with an existing calendar event.`);
        return;
      }
    }
    const res = await fetch(`${API_BASE}/api/v1/ai/apply-schedule`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saved_schedule_id: scheduleId,
        schedule: draft,
        apply: true
      })
    });
    const data = await res.json();
    if (!res.ok) {
      if (button) button.disabled = false;
      alert(data.error || "Failed to apply saved schedule.");
      return;
    }
    delete savedScheduleDrafts[scheduleId];
    savedScheduleDirtyFlags[scheduleId] = false;
    await loadHistory();
    if (typeof loadEvents === "function") {
      await loadEvents();
    }
    alert(`Applied ${data.events_created?.length || 0} session(s) to calendar.`);
  } catch (err) {
    console.error(err);
    if (button) button.disabled = false;
    alert("Failed to apply saved schedule.");
  }
}

generateScheduleBtn.addEventListener("click", async () => {
  if (!learningPlan) return;
  if (deleteAppliedBtn) {
    deleteAppliedBtn.disabled = true;
  }
  generatePlanBtn.disabled = true;
  generateScheduleBtn.disabled = true;
  setInputsDisabled({
    goal: true,
    preferences: true
  });
  learningPlanLocked = true;
  renderTopLearningPlan(learningPlan);
  renderTopScheduleMessage("Generating schedule...");
  approveBtn.disabled = true;
  if (!dayTypeSelect?.value) {
    alert("Please select Study days first.");
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    setInputsDisabled({ goal: false, preferences: false });
    return;
  }
  if (!daysPerWeekInput?.value) {
    alert("Please select Days per week.");
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    setInputsDisabled({ goal: false, preferences: false });
    return;
  }
  if (!hoursPerDayInput?.value) {
    alert("Please enter Hours per day.");
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    setInputsDisabled({ goal: false, preferences: false });
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/generate-schedule`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saved_learning_plan_id: savedLearningPlanId,
        learning_plan: learningPlan,
        preferences: getSchedulePreferences()
      })
    });
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();
    let data = null;
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    } else {
      learningPlanLocked = false;
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      setInputsDisabled({ goal: false, preferences: false });
      renderTopLearningPlan(learningPlan);
      renderTopScheduleMessage(`Error generating schedule. Server returned ${res.status}.`);
      console.error("Non-JSON response:", rawText);
      return;
    }
    console.log("Schedule response:", data);
    if (!res.ok) {
      learningPlanLocked = false;
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      setInputsDisabled({ goal: false, preferences: false });
      renderTopLearningPlan(learningPlan);
      renderTopScheduleMessage("Error: " + (data.error || `Server returned ${res.status}`));
      return;
    }
    if (data.error) {
      learningPlanLocked = false;
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      setInputsDisabled({ goal: false, preferences: false });
      renderTopLearningPlan(learningPlan);
      renderTopScheduleMessage("Error: " + data.error);
      return;
    }
    if (!data.schedule || data.schedule.length === 0) {
      learningPlanLocked = false;
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      setInputsDisabled({ goal: false, preferences: false });
      renderTopLearningPlan(learningPlan);
      renderTopScheduleMessage("No schedule could be generated.");
      return;
    }
    schedule = data.schedule;
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    setInputsDisabled({
      goal: true,
      preferences: false
    });
    savedScheduleId = null;
    scheduleDrafts = {};
    scheduleLocked = false;
    learningPlanLocked = true;
    scheduleSaved = false;
    if (deleteAppliedBtn) {
      deleteAppliedBtn.disabled = true;
    }
    renderTopLearningPlan(learningPlan);
    renderTopSchedule(schedule);
    approveBtn.disabled = false;
  } catch (err) {
    console.error(err);
    learningPlanLocked = false;
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    setInputsDisabled({ goal: false, preferences: false });
    renderTopLearningPlan(learningPlan);
    renderTopScheduleMessage("Error generating schedule.");
  }
});

approveBtn.addEventListener("click", async () => {
  approveBtn.disabled = true;
  generatePlanBtn.disabled = true;
  generateScheduleBtn.disabled = true;
  setInputsDisabled({
    goal: true,
    preferences: true
  });
  document.body.classList.add("loading-cursor");
  if (!learningPlanSaved) {
    const ok = await saveLearningPlan();
    if (!ok) {
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      approveBtn.disabled = false;
      document.body.classList.remove("loading-cursor");
      return;
    }
  }
  if (!scheduleSaved) {
    const ok = await saveSchedule();
    if (!ok) {
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      approveBtn.disabled = false;
      document.body.classList.remove("loading-cursor");
      return;
    }
  }
  if (!savedScheduleId) {
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    approveBtn.disabled = false;
    document.body.classList.remove("loading-cursor");
    alert("Schedule must be saved before applying.");
    return;
  }
  learningPlanLocked = true;
  scheduleLocked = true;
  renderTopLearningPlan(learningPlan);
  renderTopSchedule(schedule);
  approveBtn.disabled = true;
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
      learningPlanLocked = false;
      scheduleLocked = false;
      renderTopLearningPlan(learningPlan);
      renderTopSchedule(schedule);
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      approveBtn.disabled = false;
      document.body.classList.remove("loading-cursor");
      alert(`Failed to add events. Server returned ${res.status}.`);
      console.error("Non-JSON response:", rawText);
      return;
    }
    if (res.status === 409) {
      learningPlanLocked = true;
      scheduleLocked = true;
      renderTopLearningPlan(learningPlan);
      renderTopSchedule(schedule);
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      approveBtn.disabled = true;
      document.body.classList.remove("loading-cursor");
      alert(data.error || "This schedule has already been applied.");
      if (typeof loadHistory === "function") {
        loadHistory();
      }
      return;
    }
    if (!res.ok) {
      learningPlanLocked = false;
      scheduleLocked = false;
      setInputsDisabled({ goal: false, preferences: false });
      renderTopLearningPlan(learningPlan);
      renderTopSchedule(schedule);
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      approveBtn.disabled = false;
      document.body.classList.remove("loading-cursor");
      alert("Failed to add events: " + (data.error || `Server returned ${res.status}`));
      return;
    }
    if (data.error) {
      learningPlanLocked = false;
      scheduleLocked = false;
      setInputsDisabled({ goal: false, preferences: false });
      renderTopLearningPlan(learningPlan);
      renderTopSchedule(schedule);
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      approveBtn.disabled = false;
      document.body.classList.remove("loading-cursor");
      alert("Failed to add events: " + data.error);
      return;
    }
    alert(`Created ${data.events_created?.length || 0} events`);
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    document.body.classList.remove("loading-cursor");
    setAppliedScheduleUI(true);
    if (typeof loadEvents === "function") {
      loadEvents();
    }
    await loadHistory();
  } catch (err) {
    learningPlanLocked = false;
    scheduleLocked = false;
    setInputsDisabled({ goal: false, preferences: false });
    renderTopLearningPlan(learningPlan);
    renderTopSchedule(schedule);
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    approveBtn.disabled = false;
    document.body.classList.remove("loading-cursor");
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
    if (Number(savedLearningPlanId) === Number(id)) {
      savedLearningPlanId = null;
      learningPlanSaved = false;
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

function toggleDetails(id, buttonEl, showLabel = "Show Details", hideLabel = "Hide Details") {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.toggle("open");
  if (buttonEl) {
    buttonEl.textContent = isOpen ? hideLabel : showLabel;
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
          ${linkedSchedule ? `Schedule ID: ${linkedSchedule.id}<br>` : "Schedule ID: —<br>"}
          Created: ${formatDateTime(plan.created_at)}<br>
          Total Hours: ${plan.total_hours ?? "-"}<br>
          Topics: ${topics.length}
        </div>
        <div class="action-row">
          <button
            class="small-btn"
            onclick="toggleDetails('${detailsId}', this, 'Show Details', 'Hide Details')"
          >
            Show Details
          </button>
          <button class="small-btn delete-btn" onclick="deleteLearningPlan(${plan.id})">Delete</button>
        </div>
        <div class="details" id="${detailsId}">
          <div class="history-plan-topics">
            ${topics.map((topic) => `
              <div class="history-topic-card">
                <div class="plan-topic-head">
                  <div>
                    <h4 class="plan-topic-title">${topic.topic || "Untitled Topic"}</h4>
                    <div class="muted-text">${topic.description || "No description provided."}</div>
                  </div>
                  <div class="action-row" style="justify-content: flex-end; align-items: center;">
                    <span class="chip">${topic.difficulty_rating || "unknown"}</span>
                    <span class="chip">${topic.estimated_hours || 0}h</span>
                  </div>
                </div>
                <div class="topic-subtopics">
                  ${(topic.subtopics || []).map(sub => `<span class="tag">${sub}</span>`).join("")}
                </div>
              </div>
            `).join("")}
          </div>
          <div class="action-row" style="margin-top: 12px;">
            ${
              linkedSchedule
                ? `<button class="small-btn" onclick="jumpToSavedSchedule(${linkedSchedule.id})">Open Saved Schedule</button>`
                : `<button class="small-btn" onclick="generateScheduleFromSavedPlan(${plan.id}, this)" ${historyGeneratingPlanId === plan.id ? "disabled" : ""}>Generate Schedule</button>`
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
    const originalSessions = scheduleItem.schedule?.schedule || [];
    const sessions = savedScheduleDrafts[scheduleItem.id] || originalSessions;
    const detailsId = `saved-schedule-details-${scheduleItem.id}`;
    const cardId = `saved-schedule-card-${scheduleItem.id}`;
    const statusClass = scheduleItem.status === "applied" ? "applied" : "draft";
    const linkedPlan = loadedHistoryPlans.find(
      p => Number(p.id) === Number(scheduleItem.learning_plan_id)
    );
    const scheduleTitle = linkedPlan?.goal || `Schedule #${scheduleItem.id}`;
    const isApplied = scheduleItem.status === "applied";
    const canApply = !isApplied;
        return `
      <div class="card" id="${cardId}">
        <h4>${escapeHtml(scheduleTitle)}</h4>
        <div class="meta">
          <span class="chip ${statusClass}">${scheduleItem.status || "unknown"}</span>
          Schedule ID: ${scheduleItem.id}<br>
          Created: ${formatDateTime(scheduleItem.created_at)}<br>
          ${scheduleItem.applied_at ? `Applied: ${formatDateTime(scheduleItem.applied_at)}<br>` : "Not applied yet<br>"}
          Sessions: ${sessions.length}
        </div>
        <div class="action-row">
          <button class="small-btn toggle-sessions-btn" onclick="toggleDetails('${detailsId}', this, 'Show Sessions', 'Hide Sessions')">
            Show Sessions
          </button>
          <button class="small-btn delete-btn" onclick="deleteSchedule(${scheduleItem.id})">Delete</button>
        </div>
        <div class="details" id="${detailsId}">
          <div class="history-schedule-sessions">
            ${sessions.map((session, sessionIndex) => {
              const start = new Date(session.start);
              const end = new Date(session.end);
              const dateValue = isNaN(start) ? "" : start.toISOString().slice(0, 10);
              const startValue = isNaN(start) ? "" : start.toTimeString().slice(0, 5);
              const endValue = isNaN(end) ? "" : end.toTimeString().slice(0, 5);
              const weekday = isNaN(start)
                ? "—"
                : start.toLocaleDateString(undefined, { weekday: "long" });
              return `
                <div class="schedule-session-card">
                  <div class="schedule-session-head">
                    <div style="flex: 1;">
                      <input
                        class="edit-input session-title-input"
                        type="text"
                        value="${escapeHtml(session.topic || "")}"
                        onchange="updateSavedScheduleField(${scheduleItem.id}, ${sessionIndex}, 'topic', this.value)"
                        ${isApplied ? "disabled" : ""}
                      />
                      <div class="muted-text" style="margin-top: 8px;">
                        <strong>${weekday}</strong>
                      </div>
                    </div>
                    <div class="action-row">
                      <button
                        class="icon-btn delete-btn"
                        onclick="deleteSavedScheduleSession(${scheduleItem.id}, ${sessionIndex})"
                        ${isApplied ? "disabled" : ""}
                        title="Delete session"
                        aria-label="Delete session"
                      >
                        <span class="trash-icon">🗑</span>
                      </button>
                    </div>
                  </div>
                  <div class="schedule-edit-grid">
                    <div>
                      <label class="field-label">Date</label>
                      <input
                        class="edit-input"
                        type="date"
                        value="${dateValue}"
                        onchange="updateSavedScheduleDateTime(${scheduleItem.id}, ${sessionIndex}, 'date', this.value)"
                        ${isApplied ? "disabled" : ""}
                      />
                    </div>
                    <div>
                      <label class="field-label">Start Time</label>
                      <input
                        class="edit-input"
                        type="time"
                        value="${startValue}"
                        onchange="updateSavedScheduleDateTime(${scheduleItem.id}, ${sessionIndex}, 'start', this.value)"
                        ${isApplied ? "disabled" : ""}
                      />
                    </div>
                    <div>
                      <label class="field-label">End Time</label>
                      <input
                        class="edit-input"
                        type="time"
                        value="${endValue}"
                        onchange="updateSavedScheduleDateTime(${scheduleItem.id}, ${sessionIndex}, 'end', this.value)"
                        ${isApplied ? "disabled" : ""}
                      />
                    </div>
                  </div>
                  <div style="margin-top: 12px;">
                    <label class="field-label">Subtopics (comma separated)</label>
                    <input
                      class="edit-input"
                      type="text"
                      value="${escapeHtml((session.subtopics || []).join(", "))}"
                      onchange="updateSavedScheduleSubtopics(${scheduleItem.id}, ${sessionIndex}, this.value)"
                      ${isApplied ? "disabled" : ""}
                    />
                  </div>
                </div>
              `;
            }).join("")}
          </div>
          <div class="action-row" style="margin-top: 14px;">
            <button class="btn btn-accent" id="apply-saved-schedule-btn-${scheduleItem.id}" onclick="applyEditedSavedSchedule(${scheduleItem.id})" ${canApply ? "" : "disabled"}>Apply to Calendar</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function generateScheduleFromSavedPlan(planId, buttonEl) {
  const selectedPlan = loadedHistoryPlans.find(p => Number(p.id) === Number(planId));
  historyGeneratingPlanId = planId;
  renderLearningPlans(loadedHistoryPlans);
  if (!selectedPlan) {
    alert("Saved learning plan not found.");
    return;
  }
  const extractedPlan = selectedPlan.plan?.learning_plan || [];
  if (!Array.isArray(extractedPlan) || extractedPlan.length === 0) {
    alert("This saved learning plan has no topics.");
    return;
  }
  if (!dayTypeSelect?.value) {
    alert("Please select Study days first.");
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    historyGeneratingPlanId = null;
    renderLearningPlans(loadedHistoryPlans);
    if (buttonEl) buttonEl.disabled = false;
    setInputsDisabled({ goal: false, preferences: false });
    return;
  }
  if (!daysPerWeekInput?.value) {
    alert("Please select Days per week.");
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    historyGeneratingPlanId = null;
    renderLearningPlans(loadedHistoryPlans);
    if (buttonEl) buttonEl.disabled = false;
    setInputsDisabled({ goal: false, preferences: false });
    return;
  }
  if (!hoursPerDayInput?.value) {
    alert("Please enter Hours per day.");
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    historyGeneratingPlanId = null;
    renderLearningPlans(loadedHistoryPlans);
    if (buttonEl) buttonEl.disabled = false;
    setInputsDisabled({ goal: false, preferences: false });
    return;
  }
  learningPlan = extractedPlan;
  savedLearningPlanId = selectedPlan.id;
  savedScheduleId = null;
  schedule = null;
  learningPlanSaved = true;
  scheduleSaved = false;
  historyGeneratingPlanId = planId;
  generatePlanBtn.disabled = true;
  generateScheduleBtn.disabled = true;
  if (buttonEl) {
    buttonEl.disabled = true;
  }
  renderLearningPlans(loadedHistoryPlans);
  if (deleteAppliedBtn) {
    deleteAppliedBtn.disabled = true;
  }
  if (deleteAppliedBtn) {
    deleteAppliedBtn.disabled = true;
  }
  generatedGoalText = selectedPlan.goal || "";
  generatedPlanTotalHours = selectedPlan.total_hours || 10;
  learningPlanLocked = true;
  goalInput.value = selectedPlan.goal || "";
  setInputsDisabled({
    goal: true,
    preferences: true
  });
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
        preferences: getSchedulePreferences()
      })
    });
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();
    let data = {};
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    } else {
      learningPlanLocked = false;
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      if (buttonEl) buttonEl.disabled = false;
      setInputsDisabled({ goal: false, preferences: false });
      renderTopLearningPlan(learningPlan);
      renderTopScheduleMessage(`Error generating schedule. Server returned ${res.status}.`);
      console.error("Non-JSON response:", rawText);
      historyGeneratingPlanId = null;
      renderLearningPlans(loadedHistoryPlans);
      return;
    }
    if (!res.ok) {
      learningPlanLocked = false;
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      if (buttonEl) buttonEl.disabled = false;
      setInputsDisabled({ goal: false, preferences: false });
      renderTopLearningPlan(learningPlan);
      renderTopScheduleMessage("Error: " + (data.error || `Server returned ${res.status}`));
      historyGeneratingPlanId = null;
      renderLearningPlans(loadedHistoryPlans);
      return;
    }
    if (data.error) {
      learningPlanLocked = false;
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      if (buttonEl) buttonEl.disabled = false;
      setInputsDisabled({ goal: false, preferences: false });
      renderTopLearningPlan(learningPlan);
      renderTopScheduleMessage("Error: " + data.error);
      historyGeneratingPlanId = null;
      renderLearningPlans(loadedHistoryPlans);
      return;
    }
    schedule = data.schedule;
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    historyGeneratingPlanId = null;
    renderLearningPlans(loadedHistoryPlans);
    if (buttonEl) buttonEl.disabled = false;
    setInputsDisabled({
      goal: true,          // stays locked
      preferences: false   // unlock these
    });
    savedScheduleId = null;
    scheduleDrafts = {};
    scheduleLocked = false;
    learningPlanLocked = true;
    scheduleSaved = false;
    renderTopLearningPlan(learningPlan);
    renderTopSchedule(schedule);
    approveBtn.disabled = false;
    topSaveScheduleBtn.disabled = false;
    const plannerSection = document.getElementById("plannerSection");
    if (plannerSection) {
      plannerSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    await loadHistory();
  } catch (err) {
    console.error(err);
    learningPlanLocked = false;
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    if (buttonEl) buttonEl.disabled = false;
    setInputsDisabled({ goal: false, preferences: false });
    renderTopLearningPlan(learningPlan);
    renderTopScheduleMessage("Error generating schedule.");
    historyGeneratingPlanId = null;
    renderLearningPlans(loadedHistoryPlans);
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
  learningPlanSaved = true;
  scheduleSaved = true;
  if (selectedSchedule.status === "applied") {
    setAppliedScheduleUI(true);
  }
  learningPlanLocked = true;
  scheduleLocked = true;
  renderTopLearningPlan(learningPlan);
  approveBtn.disabled = true;
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
    setAppliedScheduleUI(true);
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
  scheduleLocked = selectedSchedule.status === "applied";
  // Explicitly clear the top planner area
  schedule = null;
  savedScheduleId = null;
  approveBtn.disabled = true;
  renderTopScheduleMessage("Open the schedule from the Saved Schedules section below.");
  // Close any other open schedule details first
  document.querySelectorAll('[id^="saved-schedule-details-"]').forEach(el => {
    el.classList.remove("open");
  });
  document.querySelectorAll('[id^="saved-schedule-card-"] .toggle-sessions-btn').forEach(btn => {
    btn.textContent = "Show Sessions";
  });
  // Open the matching saved schedule card below
  const detailsEl = document.getElementById(`saved-schedule-details-${scheduleId}`);
  const cardEl = document.getElementById(`saved-schedule-card-${scheduleId}`);
  if (detailsEl) {
    detailsEl.classList.add("open");
  }
  const toggleBtn = cardEl?.querySelector(".toggle-sessions-btn");
  if (toggleBtn) {
    toggleBtn.textContent = "Hide Sessions";
  }
  if (cardEl) {
    cardEl.classList.add("highlight-card");
    cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      cardEl.classList.remove("highlight-card");
    }, 2000);
  }
}

function syncTopSaveButtons() {
  if (topSaveLearningPlanBtn) {
    const canSavePlan = Array.isArray(learningPlan) && learningPlan.length > 0 && !learningPlanSaved;
    topSaveLearningPlanBtn.disabled = !canSavePlan;
  }
  if (topSaveScheduleBtn) {
    const canSaveSchedule = Array.isArray(schedule) && schedule.length > 0 && !scheduleSaved && !scheduleLocked;
    topSaveScheduleBtn.disabled = !canSaveSchedule;
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
  const cardsHtml = plan.map((topic, index) => `
    <div class="plan-topic-card">
      <div class="plan-topic-head">
        <div>
          <h4 class="plan-topic-title">${topic.topic || "Untitled Topic"}</h4>
          <div class="muted-text">${topic.description || "No description provided."}</div>
        </div>
        <div class="action-row" style="justify-content: flex-end; align-items: center;">
          <span class="chip">${topic.difficulty_rating || "unknown"}</span>
          <span class="chip">${topic.estimated_hours || 0}h</span>
          <button class="icon-btn delete-btn" ${learningPlanLocked ? "disabled" : `onclick="deletePlanTopic(${index})"`} title="Delete topic" aria-label="Delete topic">
            <span class="trash-icon">🗑</span>
          </button>
        </div>
      </div>
      <div class="topic-subtopics">
        ${(topic.subtopics || []).map(sub => `<span class="tag">${sub}</span>`).join("")}
      </div>
    </div>
  `).join("");
  planOutput.innerHTML = `
    ${cardsHtml}
    <div class="action-row" style="margin-top: 14px;">
      <button class="btn btn-accent" onclick="saveLearningPlan()" ${learningPlanSaved ? "disabled" : ""}>
        Save Learning Plan
      </button>
    </div>
  `;
  if (typeof updateQuickStats === "function") updateQuickStats();
  syncTopSaveButtons();
}

function deletePlanTopic(index) {
  if (!Array.isArray(learningPlan) || learningPlanLocked) return;
  const confirmed = window.confirm("Are you sure you want to delete this topic?");
  if (!confirmed) return;
  learningPlan.splice(index, 1);
  learningPlanSaved = false;
  savedLearningPlanId = null;
  window.learningPlanState = learningPlan;
  renderTopLearningPlan(learningPlan);
}

function renderTopSchedule(scheduleItems) {
  if (!Array.isArray(scheduleItems) || scheduleItems.length === 0) {
    scheduleOutput.innerHTML = `<div class="output-empty">No schedule yet.</div>`;
    window.scheduleState = [];
    if (typeof updateQuickStats === "function") updateQuickStats();
    return;
  }
  window.scheduleState = scheduleItems;
  scheduleOutput.innerHTML = `
    <div class="action-row" style="margin-bottom: 14px;">
      <button class="btn btn-secondary" onclick="showAddScheduleForm()" ${scheduleLocked ? "disabled" : ""}>Add Extra Topic</button>
    </div>
    <div id="addScheduleFormContainer" style="display:none; margin-bottom: 16px;"></div>
    ${scheduleItems.map((session, index) => {
      const draft = scheduleDrafts[index] || { ...session, subtopics: [...(session.subtopics || [])] };
      const start = new Date(draft.start);
      const end = new Date(draft.end);
      const weekday = isNaN(start) ? "—" : start.toLocaleDateString(undefined, { weekday: "long" });
      const dateValue = isNaN(start) ? "" : start.toISOString().slice(0, 10);
      const startValue = isNaN(start) ? "" : start.toTimeString().slice(0, 5);
      const endValue = isNaN(end) ? "" : end.toTimeString().slice(0, 5);
      const isDirty = JSON.stringify(draft) !== JSON.stringify(session);
      return `
        <div class="schedule-session-card">
          <div class="schedule-session-head">
            <div style="flex: 1;">
              <input
                class="edit-input session-title-input"
                type="text"
                value="${escapeHtml(draft.topic || "")}"
                onchange="updateScheduleDraftField(${index}, 'topic', this.value)"
                ${scheduleLocked ? "disabled" : ""}
              />
              <div class="muted-text" style="margin-top: 8px;">
                <strong>${weekday}</strong>
              </div>
            </div>
            <div class="action-row">
              <button class="icon-btn delete-btn" ${scheduleLocked ? "disabled" : `onclick="deleteScheduleSession(${index})"`} title="Delete session" aria-label="Delete session">
                <span class="trash-icon">🗑</span>
              </button>
            </div>
          </div>
          <div class="schedule-edit-grid">
            <div>
              <label class="field-label">Date</label>
              <input
                class="edit-input"
                type="date"
                value="${dateValue}"
                onchange="updateScheduleDraftDateTime(${index}, 'date', this.value)"
                ${scheduleLocked ? "disabled" : ""}
              />
            </div>
            <div>
              <label class="field-label">Start Time</label>
              <input
                class="edit-input"
                type="time"
                value="${startValue}"
                onchange="updateScheduleDraftDateTime(${index}, 'start', this.value)"
                ${scheduleLocked ? "disabled" : ""}
              />
            </div>
            <div>
              <label class="field-label">End Time</label>
              <input
                class="edit-input"
                type="time"
                value="${endValue}"
                onchange="updateScheduleDraftDateTime(${index}, 'end', this.value)"
                ${scheduleLocked ? "disabled" : ""}
              />
            </div>
          </div>
          <div style="margin-top: 12px;">
            <label class="field-label">Subtopics (comma separated)</label>
            <input
              class="edit-input"
              type="text"
              value="${escapeHtml((draft.subtopics || []).join(", "))}"
              onchange="updateScheduleDraftSubtopics(${index}, this.value)"
              ${scheduleLocked ? "disabled" : ""}
            />
          </div>
          ${
            !scheduleLocked && isDirty
              ? `
                <div class="action-row" style="margin-top: 14px;">
                  <button class="btn btn-primary" onclick="saveScheduleDraft(${index})">Save Changes</button>
                  <button class="btn btn-secondary" onclick="discardScheduleDraft(${index})">Discard</button>
                </div>
              `
              : ""
          }
        </div>
      `;
    }).join("")}
    <div class="action-row" style="margin-top: 14px;">
      <button class="btn btn-accent" onclick="saveSchedule()" ${scheduleSaved || scheduleLocked ? "disabled" : ""}>
        Save Schedule
      </button>
    </div>
  `;
  if (typeof updateQuickStats === "function") updateQuickStats();
  syncTopSaveButtons();
}

function renderTopPlanMessage(message) {
  planOutput.innerHTML = `<div class="output-empty">${message}</div>`;
  window.learningPlanState = [];
  if (typeof updateQuickStats === "function") updateQuickStats();
  syncTopSaveButtons();
}

function renderTopScheduleMessage(message) {
  scheduleOutput.innerHTML = `<div class="output-empty">${message}</div>`;
  window.scheduleState = [];
  if (typeof updateQuickStats === "function") updateQuickStats();
  syncTopSaveButtons();
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getScheduleDraft(index) {
  if (!scheduleDrafts[index]) {
    scheduleDrafts[index] = {
      ...schedule[index],
      subtopics: [...(schedule[index].subtopics || [])]
    };
  }
  return scheduleDrafts[index];
}

function updateScheduleDraftField(index, field, value) {
  if (!Array.isArray(schedule) || !schedule[index] || scheduleLocked) return;
  const draft = getScheduleDraft(index);
  draft[field] = value;
  renderTopSchedule(schedule);
}

function updateScheduleDraftSubtopics(index, value) {
  if (!Array.isArray(schedule) || !schedule[index] || scheduleLocked) return;
  const draft = getScheduleDraft(index);
  draft.subtopics = value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  renderTopSchedule(schedule);
}

function updateScheduleDraftDateTime(index, part, value) {
  if (!Array.isArray(schedule) || !schedule[index] || scheduleLocked) return;
  const draft = getScheduleDraft(index);
  const currentStart = new Date(draft.start);
  const currentEnd = new Date(draft.end);
  if (isNaN(currentStart) || isNaN(currentEnd)) return;
  let startDate = new Date(currentStart);
  let endDate = new Date(currentEnd);
  if (part === "date") {
    const [y, m, d] = value.split("-").map(Number);
    startDate.setFullYear(y, m - 1, d);
    endDate.setFullYear(y, m - 1, d);
  }
  if (part === "start") {
    const [h, min] = value.split(":").map(Number);
    startDate.setHours(h, min, 0, 0);
  }
  if (part === "end") {
    const [h, min] = value.split(":").map(Number);
    endDate.setHours(h, min, 0, 0);
  }
  draft.start = startDate.toISOString();
  draft.end = endDate.toISOString();
  renderTopSchedule(schedule);
}

function discardScheduleDraft(index) {
  delete scheduleDrafts[index];
  renderTopSchedule(schedule);
}

function updateScheduleField(index, field, value) {
  if (!Array.isArray(schedule) || !schedule[index]) return;
  schedule[index][field] = value;
  window.scheduleState = schedule;
  renderTopSchedule(schedule);
}

function updateScheduleSubtopics(index, value) {
  if (!Array.isArray(schedule) || !schedule[index]) return;
  schedule[index].subtopics = value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  window.scheduleState = schedule;
  renderTopSchedule(schedule);
}

function updateScheduleDateTime(index, part, value) {
  if (!Array.isArray(schedule) || !schedule[index]) return;
  const currentStart = new Date(schedule[index].start);
  const currentEnd = new Date(schedule[index].end);
  if (isNaN(currentStart) || isNaN(currentEnd)) return;
  let startDate = new Date(currentStart);
  let endDate = new Date(currentEnd);
  if (part === "date") {
    const [y, m, d] = value.split("-").map(Number);
    startDate.setFullYear(y, m - 1, d);
    endDate.setFullYear(y, m - 1, d);
  }
  if (part === "start") {
    const [h, min] = value.split(":").map(Number);
    startDate.setHours(h, min, 0, 0);
  }
  if (part === "end") {
    const [h, min] = value.split(":").map(Number);
    endDate.setHours(h, min, 0, 0);
  }
  if (endDate <= startDate) {
    alert("End time must be after start time.");
    return;
  }
  schedule[index].start = startDate.toISOString();
  schedule[index].end = endDate.toISOString();
  window.scheduleState = schedule;
  renderTopSchedule(schedule);
}

function deleteScheduleSession(index) {
  if (!Array.isArray(schedule) || scheduleLocked) return;
  schedule.splice(index, 1);
  delete scheduleDrafts[index];
  scheduleSaved = false;
  savedScheduleId = null;
  window.scheduleState = schedule;
  renderTopSchedule(schedule);
}

function showAddScheduleForm() {
  if (scheduleLocked) return;
  const container = document.getElementById("addScheduleFormContainer");
  if (!container) return;
  container.style.display = "block";
  container.innerHTML = `
    <div class="schedule-session-card">
      <h4 class="schedule-session-title">Add Extra Topic</h4>
      <div class="schedule-edit-grid" style="margin-top: 12px;">
        <div>
          <label class="field-label">Main Topic</label>
          <input id="newTopicInput" class="edit-input" type="text" placeholder="e.g. Java Testing" />
        </div>
        <div>
          <label class="field-label">Date</label>
          <input id="newDateInput" class="edit-input" type="date" />
        </div>
        <div>
          <label class="field-label">Subtopics</label>
          <input id="newSubtopicsInput" class="edit-input" type="text" placeholder="e.g. JUnit, Mockito" />
        </div>
        <div>
          <label class="field-label">Start Time</label>
          <input id="newStartTimeInput" class="edit-input" type="time" />
        </div>
        <div>
          <label class="field-label">End Time</label>
          <input id="newEndTimeInput" class="edit-input" type="time" />
        </div>
      </div>
      <div class="action-row" style="margin-top: 14px;">
        <button class="btn btn-primary" onclick="addExtraScheduleTopic()">Add Topic</button>
        <button class="btn btn-secondary" onclick="hideAddScheduleForm()">Cancel</button>
      </div>
    </div>
  `;
}

function hideAddScheduleForm() {
  const container = document.getElementById("addScheduleFormContainer");
  if (!container) return;
  container.style.display = "none";
  container.innerHTML = "";
}

function addExtraScheduleTopic() {
  if (scheduleLocked) return;
  const topic = document.getElementById("newTopicInput")?.value.trim();
  const date = document.getElementById("newDateInput")?.value;
  const subtopicsRaw = document.getElementById("newSubtopicsInput")?.value.trim();
  const startTime = document.getElementById("newStartTimeInput")?.value;
  const endTime = document.getElementById("newEndTimeInput")?.value;
  if (!topic || !date || !startTime || !endTime) {
    alert("Please fill in topic, date, start time, and end time.");
    return;
  }
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);
  const conflict = hasScheduleConflict(start.toISOString(), end.toISOString(), null);
  if (conflict) {
    alert(conflict);
    return;
  }
  const subtopics = subtopicsRaw
    ? subtopicsRaw.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  if (!Array.isArray(schedule)) {
    schedule = [];
  }
  schedule.push({
    topic,
    session_number: 1,
    subtopics,
    start: start.toISOString(),
    end: end.toISOString()
  });
  schedule.sort((a, b) => new Date(a.start) - new Date(b.start));
  scheduleSaved = false;
  savedScheduleId = null;
  window.scheduleState = schedule;
  renderTopSchedule(schedule);
  hideAddScheduleForm();
}

function getCurrentCalendarEventsForConflictCheck() {
  const raw = window.currentCalendarEvents || [];
  return Array.isArray(raw) ? raw : [];
}

function hasScheduleConflict(candidateStart, candidateEnd, ignoreIndex = null) {
  const start = new Date(candidateStart);
  const end = new Date(candidateEnd);
  if (isNaN(start) || isNaN(end) || end <= start) {
    return "Invalid date/time range.";
  }
  // Check against other proposed schedule items
  for (let i = 0; i < (schedule || []).length; i++) {
    if (i === ignoreIndex) continue;
    const existing = schedule[i];
    const existingStart = new Date(existing.start);
    const existingEnd = new Date(existing.end);
    if (start < existingEnd && existingStart < end) {
      return "This change clashes with another proposed schedule session.";
    }
  }
  // Check against actual loaded calendar events
  for (const ev of getCurrentCalendarEventsForConflictCheck()) {
    const existingStart = new Date(ev.start);
    const existingEnd = new Date(ev.end);
    if (isNaN(existingStart) || isNaN(existingEnd)) continue;
    if (start < existingEnd && existingStart < end) {
      return "This change clashes with an existing calendar event.";
    }
  }
  return null;
}

function hasCalendarConflictOnly(candidateStart, candidateEnd) {
  const start = new Date(candidateStart);
  const end = new Date(candidateEnd);
  if (isNaN(start) || isNaN(end) || end <= start) {
    return "Invalid date/time range.";
  }
  for (const ev of getCurrentCalendarEventsForConflictCheck()) {
    const existingStart = new Date(ev.start);
    const existingEnd = new Date(ev.end);
    if (isNaN(existingStart) || isNaN(existingEnd)) continue;
    if (start < existingEnd && existingStart < end) {
      return "This session clashes with an existing calendar event.";
    }
  }
  return null;
}

function saveScheduleDraft(index) {
  if (!Array.isArray(schedule) || !schedule[index] || scheduleLocked) return;
  const draft = scheduleDrafts[index];
  if (!draft) return;
  const conflict = hasScheduleConflict(draft.start, draft.end, index);
  if (conflict) {
    alert(conflict);
    return;
  }
  schedule[index] = {
    ...draft,
    subtopics: [...(draft.subtopics || [])]
  };
  delete scheduleDrafts[index];
  scheduleSaved = false;
  savedScheduleId = null;
  window.scheduleState = schedule;
  renderTopSchedule(schedule);
}

if (topSaveLearningPlanBtn) {
  topSaveLearningPlanBtn.addEventListener("click", saveLearningPlan);
}

if (topSaveScheduleBtn) {
  topSaveScheduleBtn.addEventListener("click", saveSchedule);
}

if (deleteAppliedBtn) {
  deleteAppliedBtn.addEventListener("click", deleteAppliedSchedule);
}

async function saveLearningPlan() {
  if (!Array.isArray(learningPlan) || learningPlan.length === 0) {
    alert("No learning plan to save.");
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/save-learning-plan`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: generatedGoalText || goalInput.value.trim(),
        total_hours: generatedPlanTotalHours || 10,
        learning_plan: learningPlan
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to save learning plan.");
      return false;
    }
    savedLearningPlanId = Number(data.saved_learning_plan_id);
    learningPlanSaved = true;
    renderTopLearningPlan(learningPlan);
    await loadHistory();
    return true;
  } catch (err) {
    console.error(err);
    alert("Failed to save learning plan.");
    return false;
  }
}

async function saveSchedule() {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    alert("No schedule to save.");
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/save-schedule`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saved_learning_plan_id: savedLearningPlanId,
        learning_plan_goal: generatedGoalText || goalInput.value.trim(),
        learning_plan_total_hours: generatedPlanTotalHours || 10,
        learning_plan: learningPlan,
        preferences: getSchedulePreferences(),
        schedule: schedule
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to save schedule.");
      return false;
    }
    if (data.saved_learning_plan_id) {
      savedLearningPlanId = Number(data.saved_learning_plan_id);
      learningPlanSaved = true;
    }
    savedScheduleId = Number(data.saved_schedule_id);
    scheduleSaved = true;
    renderTopLearningPlan(learningPlan);
    renderTopSchedule(schedule);
    await loadHistory();
    return true;
  } catch (err) {
    console.error(err);
    alert("Failed to save schedule.");
    return false;
  }
}

async function deleteAppliedSchedule() {
  if (!savedScheduleId) {
    alert("No applied schedule is selected.");
    return;
  }
  const confirmed = window.confirm(
    "Delete the calendar events created by this applied schedule? The saved schedule will remain."
  );
  if (!confirmed) return;
  deleteAppliedBtn.disabled = true;
  approveBtn.disabled = true;
  generatePlanBtn.disabled = true;
  generateScheduleBtn.disabled = true;
  setInputsDisabled({
    goal: true,
    preferences: true
  });
  document.body.classList.add("loading-cursor");
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/unapply-schedule`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saved_schedule_id: savedScheduleId
      })
    });
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();
    let data = {};
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    }
    if (!res.ok) {
      generatePlanBtn.disabled = false;
      generateScheduleBtn.disabled = false;
      approveBtn.disabled = false;
      deleteAppliedBtn.disabled = false;
      document.body.classList.remove("loading-cursor");
      alert(data.error || `Failed to delete applied schedule events (${res.status})`);
      return;
    }
    document.body.classList.remove("loading-cursor");
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    scheduleLocked = false;
    learningPlanLocked = true;
    if (approveBtn) {
      approveBtn.disabled = false;
    }
    if (deleteAppliedBtn) {
      deleteAppliedBtn.disabled = true;
    }
    setInputsDisabled({
      goal: true,
      preferences: false
    });
    renderTopLearningPlan(learningPlan);
    renderTopSchedule(schedule);
    if (typeof loadEvents === "function") {
      loadEvents();
    }
    await loadHistory();
    alert(`Deleted ${data.deleted_google_events || 0} calendar event(s).`);
  } catch (err) {
    document.body.classList.remove("loading-cursor");
    generatePlanBtn.disabled = false;
    generateScheduleBtn.disabled = false;
    approveBtn.disabled = false;
    deleteAppliedBtn.disabled = false;
    setInputsDisabled({
      goal: true,
      preferences: false
    });
    console.error(err);
    alert("Failed to delete applied schedule events.");
  }
}

document.addEventListener("mousemove", (e) => {
  if (!document.body.classList.contains("loading-cursor")) return;
  document.body.style.setProperty("--x", `${e.clientX + 14}px`);
  document.body.style.setProperty("--y", `${e.clientY + 14}px`);
});

syncPreferenceInputs();
normalizeDaysPerWeekInput();
syncTopSaveButtons();

if (deleteAppliedBtn) {
  deleteAppliedBtn.disabled = true;
}

window.toggleDetails = toggleDetails;
window.deleteLearningPlan = deleteLearningPlan;
window.deleteSchedule = deleteSchedule;
window.generateScheduleFromSavedPlan = generateScheduleFromSavedPlan;
window.jumpToSavedSchedule = jumpToSavedSchedule;
window.applySavedSchedule = applySavedSchedule;
window.saveLearningPlan = saveLearningPlan;
window.saveSchedule = saveSchedule;
window.deletePlanTopic = deletePlanTopic;
window.updateScheduleDraftField = updateScheduleDraftField;
window.updateScheduleDraftSubtopics = updateScheduleDraftSubtopics;
window.updateScheduleDraftDateTime = updateScheduleDraftDateTime;
window.saveScheduleDraft = saveScheduleDraft;
window.discardScheduleDraft = discardScheduleDraft;
window.deleteScheduleSession = deleteScheduleSession;
window.showAddScheduleForm = showAddScheduleForm;
window.hideAddScheduleForm = hideAddScheduleForm;
window.addExtraScheduleTopic = addExtraScheduleTopic;
window.deleteAppliedSchedule = deleteAppliedSchedule;
window.updateSavedScheduleField = updateSavedScheduleField;
window.updateSavedScheduleSubtopics = updateSavedScheduleSubtopics;
window.updateSavedScheduleDateTime = updateSavedScheduleDateTime;
window.deleteSavedScheduleSession = deleteSavedScheduleSession;
window.applyEditedSavedSchedule = applyEditedSavedSchedule;
