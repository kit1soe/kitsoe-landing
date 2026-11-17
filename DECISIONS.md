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
- Manrope and warm neutral surfaces; visual values from landing-page-design. The initial copper accent is superseded by the owner's 17 November direction below.
- Local-only build uses noindex until domain and publication are separately approved.
- MGI-Mind is external local agent tooling. Codex stdio MCP entry added using installed binary; protocol smoke test still pending.

## 2026-11-17 — Visual direction

- The owner requests deep burgundy or dark emerald accents, a smooth animated theme change and more expressive motion. Implement these as a coherent visual refinement, not isolated effects.
- Choose burgundy as the main accent, paired with ivory, charcoal and the warm lamp. Preserve restrained typography and readable contrast in both themes.
- Visual testing means looking at the rendered website: composition, spacing, typography, transitions and interaction on desktop and mobile. Automated checks support this inspection but do not replace it.
- Public GitHub repository exists. Keep using the GitHub noreply commit address; do not publish the website.
