---
name: "code-review-checklist"
description: "Code review guidelines covering code quality, security, and best practices."
---

> Codex adaptation:
> - Source: `.agent/skills/code-review-checklist/SKILL.md`
> - Treat references to Antigravity agents as Codex skills with the same names in this package.
> - When the source says to invoke or hand off to another agent, apply that skill's guidance directly instead of expecting a native subagent feature.
> - Use `multi_tool_use.parallel` only for independent tool calls that can safely run at the same time.
> - Paths to mirrored skills were rewritten from `.agent/skills/...` to `.codex/skills/...` where applicable.

# Code Review Checklist

## Quick Review Checklist

### Correctness
- [ ] Code does what it's supposed to do
- [ ] Edge cases handled
- [ ] Error handling in place
- [ ] No obvious bugs

### Security
- [ ] Input validated and sanitized
- [ ] No SQL/NoSQL injection vulnerabilities
- [ ] No XSS or CSRF vulnerabilities
- [ ] No hardcoded secrets or sensitive credentials
- [ ] **AI-Specific:** Protection against Prompt Injection (if applicable)
- [ ] **AI-Specific:** Outputs are sanitized before being used in critical sinks

### Performance
- [ ] No N+1 queries
- [ ] No unnecessary loops
- [ ] Appropriate caching
- [ ] Bundle size impact considered

### Code Quality
- [ ] Clear naming
- [ ] DRY - no duplicate code
- [ ] SOLID principles followed
- [ ] Appropriate abstraction level

### Testing
- [ ] Unit tests for new code
- [ ] Edge cases tested
- [ ] Tests readable and maintainable

### Documentation
- [ ] Complex logic commented
- [ ] Public APIs documented
- [ ] README updated if needed

## AI & LLM Review Patterns (2025)

### Logic & Hallucinations
- [ ] **Chain of Thought:** Does the logic follow a verifiable path?
- [ ] **Edge Cases:** Did the AI account for empty states, timeouts, and partial failures?
- [ ] **External State:** Is the code making safe assumptions about file systems or networks?

### Prompt Engineering Review
```markdown
// [x] Vague prompt in code
const response = await ai.generate(userInput);

// [ok] Structured & Safe prompt
const response = await ai.generate({
  system: "You are a specialized parser...",
  input: sanitize(userInput),
  schema: ResponseSchema
});
```

## Anti-Patterns to Flag

```typescript
// [x] Magic numbers
if (status === 3) { ... }

// [ok] Named constants
if (status === Status.ACTIVE) { ... }

// [x] Deep nesting
if (a) { if (b) { if (c) { ... } } }

// [ok] Early returns
if (!a) return;
if (!b) return;
if (!c) return;
// do work

// [x] Long functions (100+ lines)
// [ok] Small, focused functions

// [x] any type
const data: any = ...

// [ok] Proper types
const data: UserData = ...
```

## Review Comments Guide

```
// Blocking issues use [!]
[!] BLOCKING: SQL injection vulnerability here

// Important suggestions use 
 SUGGESTION: Consider using useMemo for performance

// Minor nits use [ok]
[ok] NIT: Prefer const over let for immutable variable

// Questions use 
 QUESTION: What happens if user is null here?
```
