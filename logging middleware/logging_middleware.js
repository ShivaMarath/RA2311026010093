require("dotenv").config();

const LOG_API_URL = "http://20.207.122.201/evaluation-service/logs";

async function Log(stack, level, pkg, message) {


  try {
    const payload = {
      stack: stack,          // could've used shorthand but writing explicitly for clarity
      level: level,
      package: pkg,         
      message: message,
    };

    const res = await fetch(LOG_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`, 
      },
      body: JSON.stringify(payload),
    });


    const json = await res.json();

    console.log("[Logger] Response:", json); 

  } catch (err) {
    // basic error logging 
    console.error("[Logger] Error:", err.message);

    
  }
}


(async () => {
  console.log("Sending log...");

  await Log(
    "backend",
    "info",
    "middleware",
    "Logging middleware initialized successfully"
  );

  console.log("Done.");
})();

// exporting for use elsewhere
module.exports = {
  Log, // keeping object style export even though single function
};
