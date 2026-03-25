---
name: "workflow-preview"
description: "Antigravity workflow adapted for Codex. Preview server start, stop, and status check. Local development server management. Use when the user explicitly asks for the preview workflow or when the current task matches that flow."
---

> Codex adaptation:
> - Source: `.agent/workflows/preview.md`
> - Treat references to Antigravity agents as Codex skills with the same names in this package.
> - When the source says to invoke or hand off to another agent, apply that skill's guidance directly instead of expecting a native subagent feature.
> - Use `multi_tool_use.parallel` only for independent tool calls that can safely run at the same time.
> - Treat slash-command examples as explicit skill usage patterns, not as literal runtime commands.

# /preview - Preview Management

$ARGUMENTS

---

## Task

Manage preview server: start, stop, status check.

### Commands

```
/preview           - Show current status
/preview start     - Start server
/preview stop      - Stop server
/preview restart   - Restart
/preview check     - Health check
```

---

## Usage Examples

### Start Server
```
/preview start

Response:
[ship] Starting preview...
   Port: 3000
   Type: Next.js

[ok] Preview ready!
   URL: http://localhost:3000
```

### Status Check
```
/preview

Response:
=== Preview Status ===

 URL: http://localhost:3000
 Project: C:/projects/my-app
 Type: nextjs
 Health: OK
```

### Port Conflict
```
/preview start

Response:
[!] Port 3000 is in use.

Options:
1. Start on port 3001
2. Close app on 3000
3. Specify different port

Which one? (default: 1)
```

---

## Technical

Auto preview uses `auto_preview.py` script:

```bash
python .agent/scripts/auto_preview.py start [path] [port]
python .agent/scripts/auto_preview.py stop
python .agent/scripts/auto_preview.py status
```
