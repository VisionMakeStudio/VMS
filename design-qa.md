# VMS Public Website — Design QA

## Evidence

- Source visual truth: `/workspace/scratch/b3f1716f07da/generated_images/exec-903b8664-6ba8-4a12-b2f2-4bbc038a3596.png`
- Browser-rendered implementation: `/workspace/scratch/b3f1716f07da/vms-upgrade/public-website-v2/qa/prototype-desktop-1024.jpg`
- Mobile browser capture: `/workspace/scratch/b3f1716f07da/vms-upgrade/public-website-v2/qa/prototype-mobile-top.jpg`
- Same-input comparison: `/workspace/scratch/b3f1716f07da/vms-upgrade/public-website-v2/qa/design-comparison-1024.jpg`
- Reference crop: `/workspace/scratch/b3f1716f07da/vms-upgrade/public-website-v2/qa/reference-top.png`
- State: light public homepage, `Website` improvement selected, score `63`, hero phrase fixed to `grow stronger.` for comparison.
- Source pixels: `1024 × 1536`; normalized comparison crop: `1024 × 893`.
- Implementation pixels: `1024 × 893`; comparison harness: `1024 × 893` outer capture with a `1009 × 893` CSS layout viewport because of the browser scrollbar; device density `1×`.
- Mobile pixels: `390 × 844`; app content viewport measured `375px` wide after its scrollbar; device density `1×`.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: Inter Variable is loaded locally, the two-line hero hierarchy matches the source, the red phrase is optically balanced, small uppercase labels preserve the source tracking, and mobile wrapping is controlled. The mock’s generated display lettering is slightly wider than the browser-rendered Inter at some widths; this is acceptable P3 drift and does not change hierarchy.
- Spacing and layout rhythm: desktop margins, hero height, selector placement, three-column scorecard, score ring alignment, rail density, radii, borders, and elevation now follow the source composition. Below-the-fold sections extend the selected direction without disrupting the first-screen hierarchy.
- Colors and visual tokens: navy `#003049`, cream `#FDF0D5`, red `#C1121F`, blue `#669BBC`, restrained orange `#F15B2A`, and green success states map cleanly to the selected concept with accessible foreground contrast.
- Image quality and asset fidelity: the real VMS raster logo is used. The hero contour motif is a purpose-built raster asset aligned to the source art direction. No placeholder imagery, handcrafted SVG art, emoji, or fake product assets are present.
- Copy and content: the approved option-3 headline and checkup language are preserved. Services use the current VMS names, including `Local Presence`, and no unapproved final pricing was invented.
- Icons: all interface icons come from one Phosphor icon family with consistent optical size, stroke treatment, and selected-state behavior.
- Accessibility and responsiveness: semantic buttons, labels, dialog roles, alt text, visible focus rings, practical touch targets, keyboard Escape support, and `prefers-reduced-motion` behavior are implemented. Mobile measured `scrollWidth = clientWidth`, so there is no horizontal overflow.

## Focused Region Review

The same-input comparison is saved at native comparison resolution and keeps the header, hero, selector, score ring, finding, recommendation, and service rail readable in one frame. Additional focused crops were not needed because those high-risk typography, icon, spacing, and scorecard details are already legible at `1×`. The service grid and checkup form were separately inspected in the live browser.

## Interaction and Browser Checks

- Improvement tabs: selecting `Get Found` set `aria-selected="true"`, changed the score/content, and updated the recommended service.
- Scroll-reactive score: the example score changed from `63` to `69` as the scorecard moved through the viewport.
- Mobile navigation: hamburger opens and closes the complete menu without hiding the logo or causing overflow.
- Service exploration: `See what’s included` opens the correct modal; `Request This Service` closes it and hands the selected service to the checkup flow.
- Member Portal: email-link modal accepts a QA email and displays the secure-link success state.
- Business Checkup: required fields submit in QA mode and display the queue success state; QA mode intentionally avoids writing the dummy request to local storage.
- Navigation: Services, Business Checkup, How It Works, and CTA anchors reach their intended sections.
- Console: checked desktop and mobile browser logs. No errors or warnings originated from `terminal.local`; only unrelated cloud-browser extension metadata errors appeared.

## Comparison History

### Pass 1 — blocked

- [P1] Hero headline wrapped to three lines at desktop width, changing the source hierarchy.
  - Fix: enforced the exact two-line structure, adjusted the responsive display scale, and tightened hero spacing.
- [P2] Desktop content margins and selector width were too wide relative to the source frame.
  - Fix: aligned the desktop container and header to the source’s approximately `52px` side margins at the target width.
- [P2] Scorecard was too tall and pushed the ring downward.
  - Fix: replaced the verbose finding layout with the source-style headline/body/recommendation anatomy, compacted the service rail, and reduced the panel minimum height.
- [P2] Process heading wrapped at desktop width.
  - Fix: widened the process heading region and kept the desktop title on one line while preserving mobile wrapping.

### Pass 2 — passed

- Evidence: `qa/design-comparison-1024.jpg`.
- Post-fix result: the desktop crop preserves the source hierarchy, margins, two-line hero, selector position, score-ring alignment, finding density, service rail, palette, and visible asset treatment.
- Mobile evidence: `qa/prototype-mobile-top.jpg`; the hero remains exactly two lines, the selector becomes a touch-friendly `2 × 2` layout, and no horizontal overflow is present.

## Open Questions

- None blocking. Live email delivery, real authentication, and server-backed form delivery are implementation integrations rather than design-QA gaps.

## Implementation Checklist

- [x] Match the selected option-3 first screen.
- [x] Preserve the approved VMS logo and palette.
- [x] Implement desktop and mobile responsiveness.
- [x] Make core navigation, selector, forms, modals, and success states work.
- [x] Add reduced-motion support and visible focus states.
- [x] Verify live browser rendering, mobile overflow, interactions, and console output.
- [x] Compare source and implementation in the same normalized image.

final result: passed
