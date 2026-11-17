# Project state

Updated: 2026-11-17 (Asia/Yekaterinburg).
Stage: first implementation and functional checks complete; visual refinement is the priority.

## Completed

- Full brief gathered; owner delegated technical/design choices.
- landing-page-design and modern-web-guidance installed project-locally under .agents/skills.
- Understand Anything already installed and core built.
- MGI-Mind 2.8.2 installed with local models; doctor found Qdrant stopped but no missing components.
- Codex global mgimind stdio MCP entry added. Library/create/add/search roundtrip verified.
- Public repository https://github.com/kit1soe/kitsoe-landing created; initial commit pushed.
- Astro landing implemented: light/dark themes, lamp demo, booking/tasks demos, services/process/FAQ, local inquiry draft, legal pages, favicon and social image.
- Dev server: http://127.0.0.1:4321. Public contacts centralized in src/config/site.ts.

## Actual checks

- GitHub CLI login, public repository and initial push verified.
- Codex 0.167.2 supports resume [SESSION_ID] [PROMPT] and -C; help checked.
- Node 26.8.1 and pnpm available. Astro 7.4.12 registry version checked (requires Node >=22.23.4).
- Astro build passes. Initial type check passed (deprecated lint config since fixed). Lint fix needs recheck. Browser smoke passes; screenshots are in ignored .local/ and need visual review.
- npm dev dependency minimatch override not yet resolved in lockfile; fix before final audit.

## Next action

Latest user clarification: by testing they primarily mean HOW THE PAGE LOOKS. Prioritize direct visual review, composition, typography, spacing, motion and polish across screens; do not substitute automated pass counts for design review.

Auto resume first real run FAILED: usage-limit failure had thread status systemError; original policy only allowed idle. It later crashed on Windows EPERM during state rename. Both fixed 17 November: systemError allowed ONLY with explicit usage-limit failure and backend permission; snapshot retries and independent fsynced reservation ledger prevent crashes/duplicate sends. Actual same-chat delivery tested successfully. Watcher restarted; check scripts/auto-resume.ps1 -Action Status. Current chat: 01a1e51e-2ef5-7ea1-b03a-b97c865e03b4. CLI daemon is separate from Desktop; do not use it for recovery.

Automated browser scenarios all pass at 7 widths in both themes, form/demos/menu/storage/reduced motion/no-JS routes; axe zero violations at 390 and 1440 both themes. npm audit fixed (0 vulnerabilities). Lighthouse result exists in .local/lighthouse-mobile.report.json, not yet read. Need direct visual refinement, architecture graph via Understand Anything (skill fully read, analysis NOT yet run), memory update, final docs and commits. No deployment. Browser preview at :4321, production preview :4322; verify server processes are still live after the overnight pause.

## Contacts

Public owner-provided contacts: @kitsoe and pimakarima@gmail.com. Brand kitsoe. Centralize configuration for easy later replacement.

## Constraints

No deployment, no paid services, no invented proof, no secrets in Git or memory. Preserve user changes. Persist checkpoints regularly. Skill/checkpoint tooling cannot bypass usage limits; resuming may need a new user launch.


## Checkpoint 2026-11-16T16:37:04.8780676+00:00

- Stage: Repository and memory ready
- Completed: Created and pushed public kit1soe/kitsoe-landing. Registered MGI-Mind stdio MCP and verified library/create/add/search roundtrip. Prepared brief and recovery scripts.
- Actual checks: gh auth status, remote, push and commit verified; MGI-Mind tools/list and memory roundtrip passed.
- Open issues: None recorded.
- Next action: Scaffold Astro and implement the approved sections.
- Latest commit at checkpoint: 3cbeab2 docs: define kitsoe brief and recovery workflow

Changed files at checkpoint:

```text

```


## Checkpoint 2026-11-16T17:21:44.3609003+00:00

- Stage: Native desktop auto resume configured
- Completed: Implemented a bounded watcher using native codex-app-tools MCP. It resumes the same chat only after a failed usage-limit turn and explicit backend allowance, with durable at-most-once attempts and an OS lock. Landing source and screenshots are ready for QA.
- Actual checks: 7 recovery policy tests passed; real MCP reports active/inProgress; duplicate Start blocked and Stop verified.
- Open issues: Real five-hour reset has not occurred, so that live cycle cannot yet be confirmed. CLI daemon is separate from Desktop and must not be used for thread recovery.
- Next action: Verify restarted watcher status, save focused Git checkpoint, then finish responsive, accessibility, form, performance and architecture checks.
- Latest commit at checkpoint: 3cbeab2 docs: define kitsoe brief and recovery workflow

Changed files at checkpoint:

```text
 M AGENTS.md
 M PROJECT_STATE.md
 M TASKS.md
?? .env.example
?? astro.config.mjs
?? docs/
?? eslint.config.mjs
?? package-lock.json
?? package.json
?? public/
?? scripts/auto-resume-policy.mjs
?? scripts/auto-resume.mjs
?? scripts/auto-resume.ps1
?? scripts/codex-app-client.mjs
?? src/
?? tests/
?? tsconfig.json
```
