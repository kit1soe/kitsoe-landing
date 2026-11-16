# Decisions

## 2026-11-16 — Approved scope

- Brand/pseudonym and repo name: kitsoe / kitsoe-landing.
- Public repository authorized; no website deployment.
- Audience: small business, sole proprietors, individuals.
- Premium restrained design, light and dark themes, real interactive demonstrations.
- Public contacts supplied by owner: @kitsoe and pimakarima@gmail.com; centrally configurable.
- Conversion: inquiry via Telegram/email, free consultation, individually agreed price and prepayment.
- No client testimonials or client projects exist yet; do not fabricate.

## 2026-11-16 — Implementation decisions

- Astro static output + TypeScript strict + CSS design tokens. No SPA framework or unnecessary backend.
- Form prepares a verified draft and hands it to Telegram/email; no false delivery success. Data is not stored server-side.
- Revisions included within agreed scope until delivery; additional scope discussed separately.
- Author-created demo interfaces are labeled as demonstrations, not portfolio clients or actual merchandise.
- Manrope, warm neutral surfaces and muted copper accent; visual values from landing-page-design.
- Local-only build uses noindex until domain and publication are separately approved.
- MGI-Mind is external local agent tooling. Codex stdio MCP entry added using installed binary; protocol smoke test still pending.

## Current prerequisite

GitHub CLI authorization is now verified for kit1soe. The earlier check ran before the device login completed. Create public kit1soe/kitsoe-landing; use the GitHub noreply commit address to avoid exposing a private commit email.
