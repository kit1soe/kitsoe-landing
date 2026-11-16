# Project state

Updated: 2026-11-16 (Asia/Yekaterinburg).
Stage: requirements complete; GitHub login verified; repository initialization in progress.

## Completed

- Full brief gathered; owner delegated technical/design choices.
- landing-page-design and modern-web-guidance installed project-locally under .agents/skills.
- Understand Anything already installed and core built.
- MGI-Mind 2.8.2 installed with local models; doctor found Qdrant stopped but no missing components.
- Codex global mgimind stdio MCP entry added. Live memory roundtrip pending.
- BRIEF.md, DECISIONS.md, TASKS.md, AGENTS.md and .gitignore created. Website code not started.

## Actual checks

- GitHub CLI login verified for kit1soe after device login completed. Repository kit1soe/kitsoe-landing does not yet exist.
- Codex 0.167.2 supports resume [SESSION_ID] [PROMPT] and -C; help checked.
- Node 26.8.1 and pnpm available. Astro 7.4.12 registry version checked (requires Node >=22.23.4).
- No app tests/build exist yet. No Git repository or remote created yet.

## Next action

Recheck gh auth status and resolve authorization without reading or exposing credentials. Then create the public kitsoe-landing repo, initialize Git, inspect staged contents, make initial commit and push BEFORE main implementation. Read BRIEF.md for agreed structure/copy; no new intake needed.

## Contacts

Public owner-provided contacts: @kitsoe and pimakarima@gmail.com. Brand kitsoe. Centralize configuration for easy later replacement.

## Constraints

No deployment, no paid services, no invented proof, no secrets in Git or memory. Preserve user changes. Persist checkpoints regularly. Skill/checkpoint tooling cannot bypass usage limits; resuming may need a new user launch.
