const BRAIN_API = "http://localhost:5005";

let learningPlan = null;
let schedule = null;

const goalInput = document.getElementById("goalInput");
const planOutput = document.getElementById("planOutput");
const scheduleOutput = document.getElementById("scheduleOutput");

const generatePlanBtn = document.getElementById("generatePlanBtn");
const generateScheduleBtn = document.getElementById("generateScheduleBtn");
const approveBtn = document.getElementById("approveBtn");

// -----------------------------
// STEP 1: Generate Learning Plan
// -----------------------------
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
    const res = await fetch(`${BRAIN_API}/ai/generate-learning-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal,
        total_hours: 10
      })
    });

    const data = await res.json();
    learningPlan = data.learning_plan;

    planOutput.textContent = JSON.stringify(learningPlan, null, 2);
    generateScheduleBtn.disabled = false;

  } catch (err) {
    planOutput.textContent = "Error generating learning plan";
    console.error(err);
  }
});

// -----------------------------
// STEP 2: Generate Schedule
// -----------------------------
generateScheduleBtn.addEventListener("click", async () => {
  if (!learningPlan) return;

  scheduleOutput.textContent = "Generating schedule...";
  approveBtn.disabled = true;

  try {
    const res = await fetch(`${BRAIN_API}/ai/generate-schedule`, {
      method: "POST",
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

    const data = await res.json();
    console.log("Schedule response:", data);

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
    const res = await fetch("http://localhost:5005/ai/apply-schedule", {
      method: "POST",
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
