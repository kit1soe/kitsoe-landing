# Project instructions

Read PROJECT_STATE.md, TASKS.md, DECISIONS.md and git status before resuming. Preserve completed work and user changes. User instructions take precedence.

## Product

- kitsoe is a personal developer brand, serving small businesses and individual clients.
- Russian language, restrained premium design, working light and dark themes.
- Demonstrations are explicitly labeled as interface concepts, never client projects or merchandise sold here.
- No invented customers, testimonials, performance metrics, prices or guarantees.
- One main action: discuss a project in Telegram or email. Consultation is free.
- Contact configuration must be editable in one place. These are public business contacts supplied by the owner.
- Included revisions apply to the agreed scope before delivery. Scope changes are discussed separately.
- Public GitHub repository is authorized. Website deployment is NOT authorized.

## Required workflows

- Read `.agents/skills/landing-page-design/SKILL.md` for structure and all visual tokens.
- Follow `.agents/skills/modern-web-guidance/SKILL.md`: search focused topics immediately before implementing each feature; retrieve the actual returned IDs. Disable telemetry for local CLI runs.
- Use Understand Anything only for agent-side architecture analysis, never as website functionality or a runtime dependency. Use Russian graph descriptions.
- MGI-Mind is local agent memory through the configured `mgimind` stdio MCP server. Library: `kitsoe-landing`. Search project memory when resuming; record decisions and checkpoints. User's current statements override old memory. Never store secrets, credentials or unrelated personal information.
- Update checkpoints after each meaningful stage, record actual checks, and make focused commits. Do not claim tests ran if they did not.

## Security and privacy

- Keep secrets, `.env*` (except `.env.example`), local logs, memory, test artifacts and generated knowledge graphs out of Git.
- The inquiry form builds a draft locally and opens the selected messaging channel. Never claim a message was delivered when only a draft or link was created.
- No database, analytics, tracking or external form processor in the initial version.
- No automatic messages to third parties. Browser testing must not send email or Telegram messages.
- Before push, inspect staged files and scan for secrets.

## Verification

Test meaningful form validation and handoff, demo interactions, theme persistence, mobile navigation, reduced motion, keyboard navigation, routes, console errors and accessibility.
Check widths: 360, 390, 430, 768, 1024, 1440, 1920 px, both themes.
Run build, TypeScript and lint; run browser/performance checks appropriate to the implementation. Use available supported computer-use tools according to their skill.

## Recovery

No restart loops or attempts to bypass limits. The user explicitly authorized automatic continuation of this chat after usage resets. Read docs/AUTO_RESUME.md. The native-app watcher is the only automatic recovery path; CLI daemon state is not authoritative for the desktop. Never start competing agents. Keep checkpoints current. Once all project work is complete, write .local/project-complete.json so the watcher exits. Do not create scheduled app automations to watch this task.
