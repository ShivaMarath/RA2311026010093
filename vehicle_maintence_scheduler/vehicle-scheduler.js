require("dotenv").config();
const { Log } = require("../logging middleware/logging_middleware.js");
const BASE_URL = "http://20.207.122.201/evaluation-service";
const HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${process.env.ACCESS_TOKEN}`,
};
function knapsack(tasks, budget) {
  const n = tasks.length;
  const dp = Array(n + 1).fill(null).map(() => Array(budget + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = tasks[i - 1];
    for (let w = 0; w <= budget; w++) {
      dp[i][w] = dp[i - 1][w];
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }
  let w = budget;
  const selected = [];
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(tasks[i - 1]);
      w -= tasks[i - 1].Duration;
    }
  }
  return { maxImpact: dp[n][budget], selected };
}
async function fetchDepots() {
  await Log("backend", "info", "service", "Fetching depots from evaluation service");
  const res = await fetch(`${BASE_URL}/depots`, { headers: HEADERS });
  if (!res.ok) {
    await Log("backend", "error", "service", `Failed to fetch depots: ${res.status}`);
    throw new Error(`Depots fetch failed: ${res.status}`);
  }
  const data = await res.json();
  await Log("backend", "info", "service", `Fetched ${data.depots.length} depots successfully`);
  return data.depots;
}

async function fetchVehicles() {
  await Log("backend", "info", "service", "Fetching vehicles from evaluation service");
  const res = await fetch(`${BASE_URL}/vehicles`, { headers: HEADERS });
  if (!res.ok) {
    await Log("backend", "error", "service", `Failed to fetch vehicles: ${res.status}`);
    throw new Error(`Vehicles fetch failed: ${res.status}`);
  }
  const data = await res.json();
  await Log("backend", "info", "service", `Fetched ${data.vehicles.length} vehicles successfully`);
  return data.vehicles;
}

async function schedule() {
  await Log("backend", "info", "controller", "Vehicle Maintenance Scheduler started");
  const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);
  await Log("backend", "debug", "controller", `Running knapsack for ${depots.length} depots and ${vehicles.length} tasks`);
  for (const depot of depots) {
    const { ID, MechanicHours } = depot;
    await Log("backend", "info", "controller", `Scheduling depot ${ID} with budget ${MechanicHours} mechanic-hours`);
    const { maxImpact, selected } = knapsack(vehicles, MechanicHours);
    const totalDuration = selected.reduce((sum, t) => sum + t.Duration, 0);
    console.log(`\n--- Depot ${ID} (Budget: ${MechanicHours}h) ---`);
    console.log(`Tasks selected: ${selected.length}`);
    console.log(`Total duration used: ${totalDuration}h / ${MechanicHours}h`);
    console.log(`Max impact score: ${maxImpact}`);
    console.log("Selected tasks:");
    selected.forEach(t => {
      console.log(`  TaskID: ${t.TaskID} | Duration: ${t.Duration}h | Impact: ${t.Impact}`);
    });

    await Log("backend", "info", "controller", `Depot ${ID} scheduled: ${selected.length} tasks, impact=${maxImpact}, hours used=${totalDuration}/${MechanicHours}`);
  }

  await Log("backend", "info", "controller", "Vehicle Maintenance Scheduler completed successfully");
}
schedule().catch(async (err) => {
  await Log("backend", "fatal", "controller", `Scheduler crashed: ${err.message}`);
  console.error("Error:", err.message);
});