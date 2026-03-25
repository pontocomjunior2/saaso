---
name: "workflow-brainstorm"
description: "Antigravity workflow adapted for Codex. Structured brainstorming for projects and features. Explores multiple options before implementation. Use when the user explicitly asks for the brainstorm workflow or when the current task matches that flow."
---

> Codex adaptation:
> - Source: `.agent/workflows/brainstorm.md`
> - Treat references to Antigravity agents as Codex skills with the same names in this package.
> - When the source says to invoke or hand off to another agent, apply that skill's guidance directly instead of expecting a native subagent feature.
> - Use `multi_tool_use.parallel` only for independent tool calls that can safely run at the same time.
> - Treat slash-command examples as explicit skill usage patterns, not as literal runtime commands.

# /brainstorm - Structured Idea Exploration

$ARGUMENTS

---

## Purpose

This command activates BRAINSTORM mode for structured idea exploration. Use when you need to explore options before committing to an implementation.

---

## Behavior

When `/brainstorm` is triggered:

1. **Understand the goal**
   - What problem are we solving?
   - Who is the user?
   - What constraints exist?

2. **Generate options**
   - Provide at least 3 different approaches
   - Each with pros and cons
   - Consider unconventional solutions

3. **Compare and recommend**
   - Summarize tradeoffs
   - Give a recommendation with reasoning

---

## Output Format

```markdown
## [brainstorm] Brainstorm: [Topic]

### Context
[Brief problem statement]

---

### Option A: [Name]
[Description]

[ok] **Pros:**
- [benefit 1]
- [benefit 2]

[x] **Cons:**
- [drawback 1]

 **Effort:** Low | Medium | High

---

### Option B: [Name]
[Description]

[ok] **Pros:**
- [benefit 1]

[x] **Cons:**
- [drawback 1]
- [drawback 2]

 **Effort:** Low | Medium | High

---

### Option C: [Name]
[Description]

[ok] **Pros:**
- [benefit 1]

[x] **Cons:**
- [drawback 1]

 **Effort:** Low | Medium | High

---

## [idea] Recommendation

**Option [X]** because [reasoning].

What direction would you like to explore?
```

---

## Examples

```
/brainstorm authentication system
/brainstorm state management for complex form
/brainstorm database schema for social app
/brainstorm caching strategy
```

---

## Key Principles

- **No code** - this is about ideas, not implementation
- **Visual when helpful** - use diagrams for architecture
- **Honest tradeoffs** - don't hide complexity
- **Defer to user** - present options, let them decide
