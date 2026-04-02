# CodeOps Command Center

A real-time standards review dashboard for Claude Code projects. Hired AI agents continuously audit your codebase and surface findings — live, in your browser.

![CodeOps Command Center](public/CCC.png)

## What it does

- **Live dashboard** — findings update in real time via SSE as agents write to `.standards-review/`
- **6 specialist agents** — Code, Compliance, UX, Performance, Resilience, Visual Regression
- **Priority sidebar** — all open findings ranked by foundational severity (crashes first, nitpicks last)
- **Agent roster** — each agent has a unique avatar, mood state, and profile card
- **Finding detail** — click any finding for a plain-language explanation of why it matters
- **Responsive** — works on desktop, tablet, and mobile

## Setup

```bash
# Install dependencies
npm install

# Start the dashboard pointed at your project
node server.js --project /path/to/your/project
```

Then open `http://localhost:3177` in your browser.

The server watches `.standards-review/*.json` in your project directory. Whenever a Claude agent writes findings, the dashboard updates instantly.

## How agents write findings

Each hired agent writes a JSON file to `.standards-review/{agent-id}.json`:

```json
{
  "role": "code-reviewer",
  "lastChecked": "2026-04-02T10:00:00Z",
  "summary": "2 open, 1 resolved",
  "findings": [
    {
      "id": "cr-001",
      "severity": "issue",
      "title": "Missing input validation on public endpoint",
      "description": "The /api/submit handler does not validate...",
      "file": "src/api/submit.js",
      "line": 42,
      "status": "open",
      "createdAt": "2026-04-02T10:00:00Z",
      "resolvedAt": null
    }
  ]
}
```

**Severity levels:** `issue` · `suggestion` · `nitpick` · `praise`

## Port

Default: `3177`. Override with `PORT=<number> node server.js --project <path>`.

## Stack

- **Backend** — Node.js, Express, Chokidar
- **Frontend** — Vanilla HTML/CSS/JS, SSE
- No build step, no framework, no bundler
