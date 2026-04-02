const express = require("express");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const chokidar = require("chokidar");

const args = process.argv.slice(2);
let projectPath = ".";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--project" && args[i + 1]) {
    projectPath = args[i + 1];
    break;
  }
}

const reviewDir = path.resolve(projectPath, ".standards-review");
const PORT = process.env.PORT || 3177;

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// ── Cached findings with per-file invalidation ─────────────────
let cachedData = {};

function discoverAgents() {
  try {
    return fs.readdirSync(reviewDir).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

function readAgentFile(agent) {
  const filePath = path.join(reviewDir, `${agent}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.findings)) {
      return { role: agent, lastChecked: null, summary: "Invalid data", findings: [] };
    }
    return parsed;
  } catch {
    return { role: agent, lastChecked: null, summary: "Parse error — check JSON file", findings: [] };
  }
}

function readAllFindings() {
  const agents = discoverAgents();
  const agentSet = new Set(agents);
  // Explicitly evict keys no longer present on disk
  for (const key of Object.keys(cachedData)) {
    if (!agentSet.has(key)) delete cachedData[key];
  }
  for (const agent of agents) {
    if (!cachedData[agent]) cachedData[agent] = readAgentFile(agent);
  }
  return cachedData;
}

function refreshAgent(agent) {
  cachedData[agent] = readAgentFile(agent);
}

function removeAgent(agent) {
  delete cachedData[agent];
}

// ── REST endpoints ─────────────────────────────────────────────
app.get("/api/findings", (_req, res) => {
  res.json({ projectPath: path.resolve(projectPath), data: readAllFindings() });
});

app.delete("/api/request-audit", (_req, res) => {
  const auditFile = path.join(reviewDir, "audit-requested.json");
  try {
    if (fs.existsSync(auditFile)) fs.unlinkSync(auditFile);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/request-audit", (req, res) => {
  const auditFile = path.join(reviewDir, "audit-requested.json");
  if (fs.existsSync(auditFile)) {
    return res.json({ success: false, message: "Audit already pending." });
  }
  try {
    const payload = {
      _type: "audit-request",
      requestedAt: new Date().toISOString(),
      project: path.resolve(projectPath),
      message: "Full audit requested via Command Center. Claude: run all hired agents and write findings."
    };
    fs.writeFileSync(auditFile, JSON.stringify(payload, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── SSE endpoint ───────────────────────────────────────────────
const clients = new Set();

app.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("data: connected\n\n");
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

function broadcast() {
  const payload = JSON.stringify(cachedData);
  for (const client of clients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.warn("[SSE] Write failed — removing dead client:", err.message);
      clients.delete(client);
    }
  }
}

// ── Debounced file watcher ─────────────────────────────────────
if (!fs.existsSync(reviewDir)) {
  fs.mkdirSync(reviewDir, { recursive: true });
  console.log(`Created ${reviewDir}`);
}

let broadcastTimer = null;

const watcher = chokidar.watch(reviewDir, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
});

watcher.on("all", (event, filePath) => {
  if (!filePath.endsWith(".json")) return;
  const agent = path.basename(filePath, ".json");
  console.log(`[${event}] ${agent}.json`);

  if (event === "unlink") {
    removeAgent(agent);
  } else {
    refreshAgent(agent);
  }

  // Debounce: wait 200ms for more changes before broadcasting
  clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => {
    console.log("  → broadcasting to", clients.size, "client(s)");
    broadcast();
  }, 200);
});

// ── Graceful shutdown ──────────────────────────────────────────
function shutdown() {
  console.log("\nShutting down...");
  for (const client of clients) {
    client.end();
  }
  clients.clear();
  watcher.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ── Start ──────────────────────────────────────────────────────
readAllFindings(); // warm the cache

const server = app.listen(PORT, () => {
  console.log(`\n  CodeOps Command Center`);
  console.log(`  Project: ${path.resolve(projectPath)}`);
  console.log(`  Watching: ${reviewDir}`);
  console.log(`  Dashboard: http://localhost:${PORT}\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`\n  ↻ Port ${PORT} is in use — killing old process and restarting...`);
    try {
      if (process.platform === "win32") {
        // Windows: find PID via netstat, then taskkill
        const netstat = execSync(`netstat -ano | findstr :${PORT}`, { encoding: "utf-8" });
        const match = netstat.match(/LISTENING\s+(\d+)/);
        if (match) {
          const pid = match[1];
          execSync(`taskkill /PID ${pid} /F`);
          console.log(`  Killed PID ${pid}`);
        }
      } else {
        // macOS / Linux: lsof
        const lsof = execSync(`lsof -ti tcp:${PORT}`, { encoding: "utf-8" }).trim();
        if (lsof) {
          lsof.split("\n").forEach(pid => { execSync(`kill -9 ${pid.trim()}`); });
          console.log(`  Killed PID(s) ${lsof.replace(/\n/g, ", ")}`);
        }
      }
      // Brief pause then re-attempt
      setTimeout(() => {
        const retry = app.listen(PORT, () => {
          console.log(`  ✔ Restarted on port ${PORT}`);
          console.log(`  Project: ${path.resolve(projectPath)}`);
          console.log(`  Watching: ${reviewDir}`);
          console.log(`  Dashboard: http://localhost:${PORT}\n`);
        });
        retry.on("error", (e) => {
          console.error(`\n  ✖ Still cannot bind to port ${PORT}: ${e.message}\n`);
          process.exit(1);
        });
      }, 500);
    } catch (killErr) {
      console.error(`\n  ✖ Could not free port ${PORT}: ${killErr.message}`);
      console.error(`  Try manually: PORT=<other> node server.js --project <path>\n`);
      process.exit(1);
    }
  } else {
    console.error("\n  ✖ Server error:", err.message, "\n");
    process.exit(1);
  }
});
