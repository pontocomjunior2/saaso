---
name: "clean-code"
description: "Pragmatic coding standards - concise, direct, no over-engineering, no unnecessary comments"
---

> Codex adaptation:
> - Source: `.agent/skills/clean-code/SKILL.md`
> - Treat references to Antigravity agents as Codex skills with the same names in this package.
> - When the source says to invoke or hand off to another agent, apply that skill's guidance directly instead of expecting a native subagent feature.
> - Use `multi_tool_use.parallel` only for independent tool calls that can safely run at the same time.
> - Paths to mirrored skills were rewritten from `.agent/skills/...` to `.codex/skills/...` where applicable.

# Clean Code - Pragmatic AI Coding Standards

> **CRITICAL SKILL** - Be **concise, direct, and solution-focused**.

---

## Core Principles

| Principle | Rule |
|-----------|------|
| **SRP** | Single Responsibility - each function/class does ONE thing |
| **DRY** | Don't Repeat Yourself - extract duplicates, reuse |
| **KISS** | Keep It Simple - simplest solution that works |
| **YAGNI** | You Aren't Gonna Need It - don't build unused features |
| **Boy Scout** | Leave code cleaner than you found it |

---

## Naming Rules

| Element | Convention |
|---------|------------|
| **Variables** | Reveal intent: `userCount` not `n` |
| **Functions** | Verb + noun: `getUserById()` not `user()` |
| **Booleans** | Question form: `isActive`, `hasPermission`, `canEdit` |
| **Constants** | SCREAMING_SNAKE: `MAX_RETRY_COUNT` |

> **Rule:** If you need a comment to explain a name, rename it.

---

## Function Rules

| Rule | Description |
|------|-------------|
| **Small** | Max 20 lines, ideally 5-10 |
| **One Thing** | Does one thing, does it well |
| **One Level** | One level of abstraction per function |
| **Few Args** | Max 3 arguments, prefer 0-2 |
| **No Side Effects** | Don't mutate inputs unexpectedly |

---

## Code Structure

| Pattern | Apply |
|---------|-------|
| **Guard Clauses** | Early returns for edge cases |
| **Flat > Nested** | Avoid deep nesting (max 2 levels) |
| **Composition** | Small functions composed together |
| **Colocation** | Keep related code close |

---

## AI Coding Style

| Situation | Action |
|-----------|--------|
| User asks for feature | Write it directly |
| User reports bug | Fix it, don't explain |
| No clear requirement | Ask, don't assume |

---

## Anti-Patterns (DON'T)

| [x] Pattern | [ok] Fix |
|-----------|-------|
| Comment every line | Delete obvious comments |
| Helper for one-liner | Inline the code |
| Factory for 2 objects | Direct instantiation |
| utils.ts with 1 function | Put code where used |
| "First we import..." | Just write code |
| Deep nesting | Guard clauses |
| Magic numbers | Named constants |
| God functions | Split by responsibility |

---

## [!] Before Editing ANY File (THINK FIRST!)

**Before changing a file, ask yourself:**

| Question | Why |
|----------|-----|
| **What imports this file?** | They might break |
| **What does this file import?** | Interface changes |
| **What tests cover this?** | Tests might fail |
| **Is this a shared component?** | Multiple places affected |

**Quick Check:**
```
File to edit: UserService.ts
 Who imports this? -> UserController.ts, AuthController.ts
 Do they need changes too? -> Check function signatures
```

> [!] **Rule:** Edit the file + all dependent files in the SAME task.
> [!] **Never leave broken imports or missing updates.**

---

## Summary

| Do | Don't |
|----|-------|
| Write code directly | Write tutorials |
| Let code self-document | Add obvious comments |
| Fix bugs immediately | Explain the fix first |
| Inline small things | Create unnecessary files |
| Name things clearly | Use abbreviations |
| Keep functions small | Write 100+ line functions |

> **Remember: The user wants working code, not a programming lesson.**

---

## [!] Self-Check Before Completing (MANDATORY)

**Before saying "task complete", verify:**

| Check | Question |
|-------|----------|
| [ok] **Goal met?** | Did I do exactly what user asked? |
| [ok] **Files edited?** | Did I modify all necessary files? |
| [ok] **Code works?** | Did I test/verify the change? |
| [ok] **No errors?** | Lint and TypeScript pass? |
| [ok] **Nothing forgotten?** | Any edge cases missed? |

> [!] **Rule:** If ANY check fails, fix it before completing.

---

## Verification Scripts (MANDATORY)

> [!] **CRITICAL:** Each agent runs ONLY their own skill's scripts after completing work.

### Agent -> Script Mapping

| Agent | Script | Command |
|-------|--------|---------|
| **frontend-specialist** | UX Audit | `python .codex/skills/frontend-design/scripts/ux_audit.py .` |
| **frontend-specialist** | A11y Check | `python .codex/skills/frontend-design/scripts/accessibility_checker.py .` |
| **backend-specialist** | API Validator | `python .codex/skills/api-patterns/scripts/api_validator.py .` |
| **mobile-developer** | Mobile Audit | `python .codex/skills/mobile-design/scripts/mobile_audit.py .` |
| **database-architect** | Schema Validate | `python .codex/skills/database-design/scripts/schema_validator.py .` |
| **security-auditor** | Security Scan | `python .codex/skills/vulnerability-scanner/scripts/security_scan.py .` |
| **seo-specialist** | SEO Check | `python .codex/skills/seo-fundamentals/scripts/seo_checker.py .` |
| **seo-specialist** | GEO Check | `python .codex/skills/geo-fundamentals/scripts/geo_checker.py .` |
| **performance-optimizer** | Lighthouse | `python .codex/skills/performance-profiling/scripts/lighthouse_audit.py <url>` |
| **test-engineer** | Test Runner | `python .codex/skills/testing-patterns/scripts/test_runner.py .` |
| **test-engineer** | Playwright | `python .codex/skills/webapp-testing/scripts/playwright_runner.py <url>` |
| **Any agent** | Lint Check | `python .codex/skills/lint-and-validate/scripts/lint_runner.py .` |
| **Any agent** | Type Coverage | `python .codex/skills/lint-and-validate/scripts/type_coverage.py .` |
| **Any agent** | i18n Check | `python .codex/skills/i18n-localization/scripts/i18n_checker.py .` |

> [x] **WRONG:** `test-engineer` running `ux_audit.py`
> [ok] **CORRECT:** `frontend-specialist` running `ux_audit.py`

---

### [!] Script Output Handling (READ -> SUMMARIZE -> ASK)

**When running a validation script, you MUST:**

1. **Run the script** and capture ALL output
2. **Parse the output** - identify errors, warnings, and passes
3. **Summarize to user** in this format:

```markdown
## Script Results: [script_name.py]

### [x] Errors Found (X items)
- [File:Line] Error description 1
- [File:Line] Error description 2

### [!] Warnings (Y items)
- [File:Line] Warning description

### [ok] Passed (Z items)
- Check 1 passed
- Check 2 passed

**Should I fix the X errors?**
```

4. **Wait for user confirmation** before fixing
5. **After fixing** -> Re-run script to confirm

> [!] **VIOLATION:** Running script and ignoring output = FAILED task.
> [!] **VIOLATION:** Auto-fixing without asking = Not allowed.
> [!] **Rule:** Always READ output -> SUMMARIZE -> ASK -> then fix.
