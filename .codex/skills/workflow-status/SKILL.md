---
name: "workflow-status"
description: "Antigravity workflow adapted for Codex. Display agent and project status. Progress tracking and status board. Use when the user explicitly asks for the status workflow or when the current task matches that flow."
---

> Codex adaptation:
> - Source: `.agent/workflows/status.md`
> - Treat references to Antigravity agents as Codex skills with the same names in this package.
> - When the source says to invoke or hand off to another agent, apply that skill's guidance directly instead of expecting a native subagent feature.
> - Use `multi_tool_use.parallel` only for independent tool calls that can safely run at the same time.
> - Treat slash-command examples as explicit skill usage patterns, not as literal runtime commands.

# /status - Show Status

$ARGUMENTS

---

## Task

Show current project and agent status.

### What It Shows

1. **Project Info**
   - Project name and path
   - Tech stack
   - Current features

2. **Agent Status Board**
   - Which agents are running
   - Which tasks are completed
   - Pending work

3. **File Statistics**
   - Files created count
   - Files modified count

4. **Preview Status**
   - Is server running
   - URL
   - Health check

---

## Example Output

```
=== Project Status ===

 Project: my-ecommerce
 Path: C:/projects/my-ecommerce
 Type: nextjs-ecommerce
 Status: active

 Tech Stack:
   Framework: next.js
   Database: postgresql
   Auth: clerk
   Payment: stripe

[ok] Features (5):
    product-listing
    cart
    checkout
    user-auth
    order-history

[wait] Pending (2):
    admin-panel
    email-notifications

 Files: 73 created, 12 modified

=== Agent Status ===

[ok] database-architect -> Completed
[ok] backend-specialist -> Completed
[cycle] frontend-specialist -> Dashboard components (60%)
[wait] test-engineer -> Waiting

=== Preview ===

 URL: http://localhost:3000
 Health: OK
```

---

## Technical

Status uses these scripts:
- `session_manager.py status`
- `auto_preview.py status`
