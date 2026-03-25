---
name: "workflow-deploy"
description: "Antigravity workflow adapted for Codex. Deployment command for production releases. Pre-flight checks and deployment execution. Use when the user explicitly asks for the deploy workflow or when the current task matches that flow."
---

> Codex adaptation:
> - Source: `.agent/workflows/deploy.md`
> - Treat references to Antigravity agents as Codex skills with the same names in this package.
> - When the source says to invoke or hand off to another agent, apply that skill's guidance directly instead of expecting a native subagent feature.
> - Use `multi_tool_use.parallel` only for independent tool calls that can safely run at the same time.
> - Treat slash-command examples as explicit skill usage patterns, not as literal runtime commands.

# /deploy - Production Deployment

$ARGUMENTS

---

## Purpose

This command handles production deployment with pre-flight checks, deployment execution, and verification.

---

## Sub-commands

```
/deploy            - Interactive deployment wizard
/deploy check      - Run pre-deployment checks only
/deploy preview    - Deploy to preview/staging
/deploy production - Deploy to production
/deploy rollback   - Rollback to previous version
```

---

## Pre-Deployment Checklist

Before any deployment:

```markdown
## [ship] Pre-Deploy Checklist

### Code Quality
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] ESLint passing (`npx eslint .`)
- [ ] All tests passing (`npm test`)

### Security
- [ ] No hardcoded secrets
- [ ] Environment variables documented
- [ ] Dependencies audited (`npm audit`)

### Performance
- [ ] Bundle size acceptable
- [ ] No console.log statements
- [ ] Images optimized

### Documentation
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] API docs current

### Ready to deploy? (y/n)
```

---

## Deployment Flow

```

  /deploy        

         
         

  Pre-flight     
  checks         

         
    Pass? No Fix issues
         
        Yes
         
         

  Build          
  application    

         
         

  Deploy to      
  platform       

         
         

  Health check   
  & verify       

         
         

  [ok] Complete    

```

---

## Output Format

### Successful Deploy

```markdown
## [ship] Deployment Complete

### Summary
- **Version:** v1.2.3
- **Environment:** production
- **Duration:** 47 seconds
- **Platform:** Vercel

### URLs
-  Production: https://app.example.com
-  Dashboard: https://vercel.com/project

### What Changed
- Added user profile feature
- Fixed login bug
- Updated dependencies

### Health Check
[ok] API responding (200 OK)
[ok] Database connected
[ok] All services healthy
```

### Failed Deploy

```markdown
## [x] Deployment Failed

### Error
Build failed at step: TypeScript compilation

### Details
```
error TS2345: Argument of type 'string' is not assignable...
```

### Resolution
1. Fix TypeScript error in `src/services/user.ts:45`
2. Run `npm run build` locally to verify
3. Try `/deploy` again

### Rollback Available
Previous version (v1.2.2) is still active.
Run `/deploy rollback` if needed.
```

---

## Platform Support

| Platform | Command | Notes |
|----------|---------|-------|
| Vercel | `vercel --prod` | Auto-detected for Next.js |
| Railway | `railway up` | Needs Railway CLI |
| Fly.io | `fly deploy` | Needs flyctl |
| Docker | `docker compose up -d` | For self-hosted |

---

## Examples

```
/deploy
/deploy check
/deploy preview
/deploy production --skip-tests
/deploy rollback
```
