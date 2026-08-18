# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## VMS website decisions

- The selected visual target is the third Product Design concept, `generated_images/exec-903b8664-6ba8-4a12-b2f2-4bbc038a3596.png`.
- Keep the approved legacy `upload/VMS-Homepage.html` untouched. This project is the new sibling website version.
- Preserve the VMS logo and brand palette: navy `#003049`, cream `#FDF0D5`, red `#C1121F`, blue `#669BBC`, and restrained orange `#F15B2A`.
- The homepage must work on desktop and mobile, with touch-friendly controls, no horizontal overflow, and `prefers-reduced-motion` support.
- Core interactions are the rotating hero phrase, improvement selector, animated VMS scorecard, navigation/mobile menu, Member Portal sign-in modal, service exploration, and Free Business Checkup submission flow.
- Public service language should reflect the current VMS direction: Business Checkup, Website Revamp, Local Presence, Review Growth, VMS Smart QR, VMS LinkHub, and practical business systems. Do not invent final prices.
- Use `info@visionmakestudio.com` as the public footer contact and the central destination for website request, sales, and operational notification emails.
- The owner/staff entry point is `/staff-login/`; deployed `/admin/*` files are private and require the Netlify Identity `admin` role.
- Client accounts are created by VMS, not by public signup. Client Portal access remains passwordless email magic-link access through Supabase with new-user creation disabled.
- Keep the approved standalone Admin and Client Portal source files unchanged. Generate Netlify deployment copies under `public/admin/` and `public/portal/` during the build.
