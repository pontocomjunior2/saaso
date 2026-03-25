---
name: "antigravity-codex-bridge"
description: "Explains and maintains the Codex-adapted Antigravity skill pack in this repository. Use when translating old Antigravity skill, agent, or workflow references to the generated `.codex/skills` tree."
---

# Antigravity Codex Bridge

Use this bridge when you need to understand or maintain the Codex-adapted Antigravity pack in this repository.

## Quick Rules

- Read `references/source-map.md` to locate the generated Codex skill that matches a legacy Antigravity asset.
- Treat legacy agent names as Codex skills with the same name.
- Treat legacy workflow commands as skills prefixed with `workflow-`.
- Re-run `python scripts/sync_antigravity_to_codex.py` after changing files under `.agent/agents`, `.agent/skills`, or `.agent/workflows`.
