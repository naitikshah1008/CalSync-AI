const API_BASE = "";

let learningPlan = null;
let schedule = null;

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
        schedule: schedule,
        apply: true
      })
    });

    const data = await res.json();

    if (data.error) {
      alert("Failed to add events: " + data.error);
      return;
    }

    alert(`Created ${data.events_created?.length || 0} events`);

    if (typeof loadEvents === "function") {
      loadEvents();
    }
  } catch (err) {
    alert("Network error while applying schedule");
    console.error(err);
  }
});

const loadHistoryBtn = document.getElementById("loadHistoryBtn");
const historyPlansOutput = document.getElementById("historyPlansOutput");
const historySchedulesOutput = document.getElementById("historySchedulesOutput");

async function loadHistory() {
  try {
    const [plansRes, schedulesRes] = await Promise.all([
      fetch(`${API_BASE}/api/v1/ai/learning-plans`, {
        credentials: "include",
      }),
      fetch(`${API_BASE}/api/v1/ai/schedules`, {
        credentials: "include",
      }),
    ]);

    const plansData = await plansRes.json();
    const schedulesData = await schedulesRes.json();

    historyPlansOutput.textContent = JSON.stringify(plansData.learning_plans || [], null, 2);
    historySchedulesOutput.textContent = JSON.stringify(schedulesData.schedules || [], null, 2);
  } catch (err) {
    console.error(err);
    historyPlansOutput.textContent = "Failed to load saved plans.";
    historySchedulesOutput.textContent = "Failed to load saved schedules.";
  }
}

if (loadHistoryBtn) {
  loadHistoryBtn.addEventListener("click", loadHistory);
}
