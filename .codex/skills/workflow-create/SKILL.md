---
name: "workflow-create"
description: "Antigravity workflow adapted for Codex. Create new application command. Triggers App Builder skill and starts interactive dialogue with user. Use when the user explicitly asks for the create workflow or when the current task matches that flow."
---

> Codex adaptation:
> - Source: `.agent/workflows/create.md`
> - Treat references to Antigravity agents as Codex skills with the same names in this package.
> - When the source says to invoke or hand off to another agent, apply that skill's guidance directly instead of expecting a native subagent feature.
> - Use `multi_tool_use.parallel` only for independent tool calls that can safely run at the same time.
> - Treat slash-command examples as explicit skill usage patterns, not as literal runtime commands.

# /create - Create Application

$ARGUMENTS

---

## Task

This command starts a new application creation process.

### Steps:

1. **Request Analysis**
   - Understand what the user wants
   - If information is missing, use `conversation-manager` skill to ask

2. **Project Planning**
   - Use `project-planner` agent for task breakdown
   - Determine tech stack
   - Plan file structure
   - Create plan file and proceed to building

3. **Application Building (After Approval)**
   - Orchestrate with `app-builder` skill
   - Coordinate expert agents:
     - `database-architect` -> Schema
     - `backend-specialist` -> API
     - `frontend-specialist` -> UI

4. **Preview**
   - Start with `auto_preview.py` when complete
   - Present URL to user

---

## Usage Examples

```
/create blog site
/create e-commerce app with product listing and cart
/create todo app
/create Instagram clone
/create crm system with customer management
```

---

## Before Starting

If request is unclear, ask these questions:
- What type of application?
- What are the basic features?
- Who will use it?

Use defaults, add details later.
