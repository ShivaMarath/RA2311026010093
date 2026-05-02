require("dotenv").config();

// hmm, this import path looks a bit odd… might need cleanup later
const { Log } = require("../logging middleware/logging_middleware.js");

const BASE_URL = "http://20.207.122.201/evaluation-service";

// keeping headers here so I don’t repeat myself in fetch calls
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.ACCESS_TOKEN}`, // assuming token exists 🤞
};

// quick priority mapping (could’ve used enums but eh… this works)
const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

// super basic heap — not perfect but does the job
class MinHeap {
  constructor() {
    this.data = []; // "heap" felt too generic while typing this
  }

  size() {
    return this.data.length;
  }

  peek() {
    return this.data[0];
  }

  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return null;

    const top = this.data[0];
    const last = this.data.pop();

    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }

    return top;
  }

  _score(x) {
    return x._score; //  relying on this field being present
  }

  _bubbleUp(index) {
    // moving up until parent is smaller
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);

      if (this._score(this.data[parentIdx]) > this._score(this.data[index])) {
        // swap manually instead of destructuring
        const tmp = this.data[parentIdx];
        this.data[parentIdx] = this.data[index];
        this.data[index] = tmp;

        index = parentIdx;
      } else {
        break;
      }
    }
  }

  _sinkDown(index) {
    const length = this.data.length;

    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < length && this._score(this.data[left]) < this._score(this.data[smallest])) {
        smallest = left;
      }

      if (right < length && this._score(this.data[right]) < this._score(this.data[smallest])) {
        smallest = right;
      }

      if (smallest === index) break;

      // swap again
      const temp = this.data[smallest];
      this.data[smallest] = this.data[index];
      this.data[index] = temp;

      index = smallest;
    }
  }
}

// combining type importance + timestamp
function computeScore(notification) {
  const weight = TYPE_WEIGHT[notification.Type] || 0; // fallback just in case
  const time = new Date(notification.Timestamp).getTime();

  // I used a large multiplier so type matters more than time
  // not sure if 1e13 is overkill but it works fine for now
  return weight * 1e13 + time;
}

// picks top N notifications (default 10)
function getTopN(list, n = 10) {
  const heap = new MinHeap();

  for (let i = 0; i < list.length; i++) {
    const notif = list[i];

    // attaching score (mutating copy instead of original)
    const scored = {
      ...notif,
      _score: computeScore(notif),
    };

    if (heap.size() < n) {
      heap.push(scored);
    } else {
      const smallest = heap.peek();

      if (smallest && scored._score > smallest._score) {
        heap.pop();
        heap.push(scored);
      }
    }
  }

  // sorting at the end — slightly inefficient but simpler than keeping order
  const sorted = heap.data.sort((a, b) => b._score - a._score);

  return sorted.map((item) => {
    const { _score, ...rest } = item;
    return rest;
  });
}

// fetch from API
async function fetchNotifications() {
  await Log("backend", "info", "service", "Fetching notifications...");

  let res;

  try {
    res = await fetch(`${BASE_URL}/notifications`, { headers: HEADERS });
  } catch (err) {
    await Log("backend", "error", "service", "Fetch failed due to network issue");
    throw err;
  }

  if (!res.ok) {
    await Log("backend", "error", "service", `Bad response: ${res.status}`);
    throw new Error(`Fetch failed: ${res.status}`);
  }

  const data = await res.json();

  // guarding against weird API responses
  const notifications = data.notifications || [];

  await Log("backend", "info", "service", `Got ${notifications.length} notifications`);

  return notifications;
}

// main flow
async function runApp() {
  await Log("backend", "info", "controller", "Starting Priority Inbox");

  const notifications = await fetchNotifications();

  const top10 = getTopN(notifications, 10); // could make this configurable later

  await Log("backend", "info", "controller", "Computed top notifications");

  console.log("\n===== TOP 10 PRIORITY NOTIFICATIONS =====\n");

  // using for loop instead of forEach… just personal preference sometimes
  for (let i = 0; i < top10.length; i++) {
    const n = top10[i];

    console.log(`#${i + 1}`);
    console.log(`  ID        : ${n.ID}`);
    console.log(`  Type      : ${n.Type} (weight: ${TYPE_WEIGHT[n.Type]})`);
    console.log(`  Message   : ${n.Message}`);
    console.log(`  Timestamp : ${n.Timestamp}`);
    console.log(); // blank line
  }

  await Log("backend", "info", "controller", "Done ✔");
}

// entry point
runApp().catch(async (err) => {
  await Log("backend", "fatal", "controller", `Crashed: ${err.message}`);
  console.error("Something went wrong:", err.message);
});