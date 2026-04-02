# Agent Samples

Ready-to-use specialist agents for CodeOps Command Center. Copy these to your global Claude agent directory to activate them.

## Setup

```bash
# macOS / Linux
cp agents/*.md ~/.claude/agents/
cp agents/registry.json ~/.claude/agents/

# Windows
copy agents\*.md %USERPROFILE%\.claude\agents\
copy agents\registry.json %USERPROFILE%\.claude\agents\
```

Then start a new Claude Code session in your project — Claude will read the registry and recommend which agents fit your stack.

---

## The Roster

| File | Agent | Watches for |
|------|-------|-------------|
| `resilience-reviewer.md` | Resilience Reviewer | Crashes, silent failures, missing reconnect logic |
| `code-reviewer.md` | Code Reviewer | Logic bugs, magic numbers, missing validation |
| `compliance-reviewer.md` | Compliance Reviewer | WCAG accessibility, OWASP security, unsanitized input |
| `ux-reviewer.md` | UX Reviewer | Missing feedback, broken states, touch targets |
| `performance-reviewer.md` | Performance Reviewer | Unbounded loops, DOM thrashing, memory leaks |
| `visual-regression-reviewer.md` | Visual Regression Reviewer | Layout overflow, text clipping, viewport breakage |
| `secrets-env-reviewer.md` | Secrets & Environment Reviewer | Hardcoded API keys, committed `.env`, secrets in logs |
| `dependency-auditor.md` | Dependency Auditor | CVEs, abandoned packages, bloated dependencies |
| `data-privacy-reviewer.md` | Data Privacy Reviewer | PII in logs, plain-text passwords, GDPR violations |
| `api-design-reviewer.md` | API Design Reviewer | Inconsistent endpoints, missing error shapes, no rate limiting |
| `database-safety-reviewer.md` | Database Safety Reviewer | SQL injection, missing indexes, unsafe migrations, no RLS |
| `git-hygiene-reviewer.md` | Git Hygiene Reviewer | Vague commits, staged `.env`, binary files, no `.gitignore` |

---

## Token-Efficient Format

These agents are written in a **lean runtime format** — each file is ~35–40 lines instead of the typical 80–90. They contain only what Claude needs during a review:

- Frontmatter (id, triggers, severity prefix)
- Scope boundary (what this agent reviews and what it skips)
- Checklist (the actual checks)
- Anti-patterns (common mistakes to flag)
- Severity guide (issue / suggestion / nitpick / praise)
- Handoff rules (one line — which agent owns overlapping concerns)

The philosophy sections, evaluation criteria, and design principle essays are omitted — those are useful for humans authoring agents, not for Claude running them. This cuts token usage per audit by ~54% with no loss in review quality.

---

## Creating Your Own Agent

Use this template — keep it lean:

```markdown
---
name: Your Agent Name
id: your-agent-id
category: your-category
icon: Y
expertise: One-line description of what this agent checks
triggers: [list, of, file, change, types]
tech_signals: [list, of, relevant, technologies]
severity_prefix: ya
---

## Scope
What this agent reviews. NOT: what it explicitly skips. Max N findings.

## Checklist
1. Specific check — what to look for and why it matters
2. Another check
...

## Anti-Patterns
- Common mistake this agent catches
- Another common mistake

## Severity
- **issue**: Must-fix problems
- **suggestion**: Should-fix improvements
- **nitpick**: Optional polish
- **praise**: Good practices worth calling out

## Handoff
Overlapping concern → Other Agent | Another overlap → Another Agent
```

**Rules for lean agents:**
- Checklist items are specific and actionable — not vague ("check performance")
- Scope boundary is explicit — tells Claude what NOT to review (prevents overlap noise)
- Max findings per run is stated — prevents overwhelming the developer
- Handoff line is one line — just enough to prevent duplicate findings
- No prose — bullet points and short sentences only

Once created, add an entry to `registry.json` so Claude can discover it during the hiring flow.
