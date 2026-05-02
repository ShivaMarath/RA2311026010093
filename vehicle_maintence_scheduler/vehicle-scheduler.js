require("dotenv").config();
const { Log } = require("../logging middleware/logging_middleware.js");
const BASE_URL = "http://20.207.122.201/evaluation-service";
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.ACCESS_TOKEN}`, // assuming env is loaded correctly
};

function knapsack(tasks, budget) {
  const totalTasks = tasks.length;

  // initializing dp table
  const dp = [];
  for (let i = 0; i <= totalTasks; i++) {
    dp[i] = new Array(budget + 1).fill(0);
  }

  // filling dp table
  for (let i = 1; i <= totalTasks; i++) {
    const task = tasks[i - 1];
    const duration = task.Duration;
    const impact = task.Impact;

    for (let hours = 0; hours <= budget; hours++) {
      
      dp[i][hours] = dp[i - 1][hours];

      // try taking task if possible
      if (duration <= hours) {
        const candidate = dp[i - 1][hours - duration] + impact;

        
        if (candidate > dp[i][hours]) {
          dp[i][hours] = candidate;
        }
      }
    }
  }

  // backtracking to find selected tasks
  let remaining = budget;
  const pickedTasks = [];

  for (let i = totalTasks; i > 0; i--) {
    // if value changed, means we picked this task
    if (dp[i][remaining] !== dp[i - 1][remaining]) {
      const chosen = tasks[i - 1];
      pickedTasks.push(chosen);

      remaining -= chosen.Duration;

      // just in case (defensive, though shouldn't happen)
      if (remaining < 0) {
        // console.warn("Remaining went negative??"); // debug leftover
        remaining = 0;
      }
    }
  }

  return {
    maxImpact: dp[totalTasks][budget],
    selected: pickedTasks, // note: reverse order, but doesn't matter much here
  };
}

// fetching depots
async function fetchDepots() {
  await Log("backend", "info", "service", "Fetching depots...");

  const res = await fetch(`${BASE_URL}/depots`, { headers: HEADERS });

  if (!res.ok) {
    await Log("backend", "error", "service", `Failed to fetch depots: ${res.status}`);
    throw new Error(`Depots fetch failed: ${res.status}`);
  }

  const data = await res.json();

  // assuming API always returns this shape
  const depots = data.depots || [];

  await Log("backend", "info", "service", `Fetched ${depots.length} depots`);

  return depots;
}

// fetching vehicles (basically tasks)
async function fetchVehicles() {
  await Log("backend", "info", "service", "Fetching vehicles...");

  const res = await fetch(`${BASE_URL}/vehicles`, { headers: HEADERS });

  if (!res.ok) {
    await Log("backend", "error", "service", `Failed to fetch vehicles: ${res.status}`);
    throw new Error(`Vehicles fetch failed: ${res.status}`);
  }

  const data = await res.json();

  const vehicles = data.vehicles || [];

  await Log("backend", "info", "service", `Fetched ${vehicles.length} vehicles`);

  return vehicles;
}

// main scheduler
async function runScheduler() {
  await Log("backend", "info", "controller", "Vehicle Maintenance Scheduler started");

  // fetching both in parallel (faster... hopefully)
  const [depots, vehicles] = await Promise.all([
    fetchDepots(),
    fetchVehicles(),
  ]);

  await Log(
    "backend",
    "debug",
    "controller",
    `Running knapsack for ${depots.length} depots and ${vehicles.length} tasks`
  );

  // looping through each depot
  for (let i = 0; i < depots.length; i++) {
    const depot = depots[i];

    const depotId = depot.ID;
    const budget = depot.MechanicHours;

    await Log(
      "backend",
      "info",
      "controller",
      `Scheduling depot ${depotId} with ${budget} hours`
    );

    const result = knapsack(vehicles, budget);

    const selectedTasks = result.selected;
    const maxImpact = result.maxImpact;

    // calculating total duration manually
    let totalTime = 0;
    for (let j = 0; j < selectedTasks.length; j++) {
      totalTime += selectedTasks[j].Duration;
    }

    console.log(`\n--- Depot ${depotId} (Budget: ${budget}h) ---`);
    console.log(`Tasks selected: ${selectedTasks.length}`);
    console.log(`Total duration used: ${totalTime}h / ${budget}h`);
    console.log(`Max impact score: ${maxImpact}`);
    console.log("Selected tasks:");

    // printing tasks
    for (let k = 0; k < selectedTasks.length; k++) {
      const t = selectedTasks[k];

      console.log(
        `  TaskID: ${t.TaskID} | Duration: ${t.Duration}h | Impact: ${t.Impact}`
      );
    }

    await Log(
      "backend",
      "info",
      "controller",
      `Depot ${depotId} scheduled: ${selectedTasks.length} tasks, impact=${maxImpact}, hours=${totalTime}/${budget}`
    );
  }

  await Log(
    "backend",
    "info",
    "controller",
    "Vehicle Maintenance Scheduler completed"
  );
}


runScheduler().catch(async (err) => {
  await Log("backend", "fatal", "controller", `Scheduler crashed: ${err.message}`);
  console.error("Error:", err.message);
});
