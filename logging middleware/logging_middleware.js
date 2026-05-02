require("dotenv").config();
const LOG_API_URL = "http://20.207.122.201/evaluation-service/logs";
async function Log(stack, level, pkg, message) {

  try {
    const response = await fetch(LOG_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ stack, level, package: pkg, message }),
    });

    const data = await response.json();
    console.log("[Logger] Response:", data);
  } catch (err) {
    console.error("[Logger] Error:", err.message);
  }
}
(async () => {
  console.log("Sending log...");
  await Log("backend", "info", "middleware", "Logging middleware initialized successfully");
  console.log("Done.");
})();

module.exports = { Log };