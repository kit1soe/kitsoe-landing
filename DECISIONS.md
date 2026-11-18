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

## 2026-11-18 — Interaction and verification

- Booking uses local sample schedules. Changing day updates times and clears the previous selection. Native radio groups provide keyboard operation and a visible result announces the change.
- Keep Edge as the default verification browser. Firefox and Playwright WebKit provide additional engine coverage on Windows, with separate local reports. Mobile viewport checks do not stand in for physical iOS or Android testing.

## 2026-11-18 — Studio redesign

- The owner asked for a full visual scene, translucent material, viewport-wide lighting and richer motion. Gradients are decorative lighting layers across the page; text and controls sit on steady surfaces. Use separate original studio art for day and night instead of tinting the same scene.
- The old page snapshot stays opaque while the new one fades in. Unsupported view transitions and reduced motion apply the palette directly. Lamp brightness controls the glow opacity and material exposure separately.
- The shape in the concept is procedural WebGL, served in a chunk when the section is near. It stops drawing off screen and leaves the static illustration when WebGL is unavailable. The angle range and layer toggle are native controls usable without drag.

## 2026-11-18 — Unified art direction

- Supersede the interior backgrounds and ornamental WebGL concept after the owner’s visual review. Use a typography-led opening, recurring light across sections and common spacing. Cormorant Garamond sets the display hierarchy and Manrope serves the controls. Use wine for primary actions and a small amount of jade for light and progress.
- Draw atmospheric lines at device scale with a capped Canvas2D backing buffer. Keep the CSS light field as the background when canvas is unavailable. Pause drawing when the hero leaves the viewport, motion is disabled or the tab is hidden. Keep text fully visible in entrance states for contrast and first paint.
- Demonstrate responsive code with the same live lamp interface in a resizable container. Use a native width range and retain palette and brightness when the layout changes.
