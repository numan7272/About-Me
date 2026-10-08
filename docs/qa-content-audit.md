# Portfolio content and interaction audit

Date: 2026-10-08

## Corrections

- The owner confirmed that the Abitur was completed in June 2025 and the Google Cybersecurity Professional Certificate has been in progress since February 2026. German and English tour and station copy now reflect this.
- Station descriptions explain responsibilities and project purposes before technical stacks. Removed unsupported claims about everything being self-hosted, a real terminal sandbox, and a guaranteed contact response time.
- Agents of Change explains the owner's Business Information Systems perspective alongside tourism and hospitality students, international teamwork and more mindful travel.
- Removed the stale semester number from the public CV while preserving the module result.
- Translated settings options, renderer status and keyboard help. Settings now close with Escape and return focus to their trigger. Keyboard help fits narrow screens and scrolls vertically.

## Verification

- Production build and ESLint passed. All 23 local tests passed, including 18 tracked tests and five pre-existing local SEO tests.
- Traversed all 21 steps of the seven-stop tour and reached its completion screen. Opened contact and verified closing behavior.
- Checked German/English switching, mobile HQ access, the Learning Tour file and its expandable content.
- Checked settings translations and Escape focus return.
- Checked responsive layouts in the embedded Chromium browser at desktop size and 390 x 844 CSS pixels. At 320 x 480, keyboard help fits within the viewport, has no horizontal overflow and scrolls vertically.
- The final local preview showed the corrected certificate status. No console errors were captured in the final preview session.

## Scope and limits

Physical iPhone/Safari behavior, native browser bars, exhaustive mini-game playthroughs and repeatable cold-network timing were not verified in this content audit. No new loading-time or FPS improvement is claimed.

Pre-existing SEO work in index.html, sitemap.xml, vercel.json and tests/seo-content.test.mjs remains outside this commit. The local SEO article's mirrored descriptions were aligned with the revised copy so its consistency checks continue to pass.
