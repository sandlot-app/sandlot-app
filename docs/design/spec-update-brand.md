## Brand (added 2026-10-24)

The Sandlot emblem is an open diamond with home plate. It replaces the outlined diamond that sat next to the wordmark.

### Artwork
- The emblem was traced from the master artwork (1254×1254 px) by measuring its edges. A rasterized overlay matches the original at 97.7% IoU; the remaining differences are a one-pixel antialiasing fringe.
- Geometry, in master pixels:
  - Stroke: about 71 px wide.
  - Outer corners: radius 70 at the sides, 86 at the top. Inner corners: 16 at the sides, 25 at the top.
  - Arm ends: round caps.
  - Home plate: 159 px wide, with a 45° point, corner radii 14 / 12, and an apex radius of 16.
- Colors: emblem `#FF7519` on `#0C4C39`.

### Variables
- Primitives: `brand/orange` `#FF7519` and `brand/green` `#0C4C39`.
- Color: `logo/emblem` (aliases brand/orange) and `logo/background` (aliases brand/green).
- These are separate from the followed orange (`orange/500` `#F07A1A`), which is unchanged.

### Components (Components page, section "Brand")
- **Logo / Emblem** `124:7447`: a single flattened vector in a 64×64 frame that scales proportionally.
- **Logo / Wordmark** `124:7459`:
  - Surface=Light: "sandlot" in scoreboard green with the emblem, no background. Used in every nav bar.
  - Surface=Dark: white text on a brand-green backdrop. Used on share images.
  - **Fit (option C, "plate as descender"):** with "sandlot" in Inter Extra Bold 24, the emblem is 22.4 px and sits 4 px after the text.
    - Its top is on the ascender line (measured 0.07 px off), and the arm ends land on the baseline (0.00 px off).
    - Home plate drops 4.8 px below the baseline, inside the descender space.
    - The lockup stays 29 px tall.
    - If the wordmark is resized, scale the emblem by the same factor (0.933 × font size) and keep these alignments.
  - Neither variant clips its content.
- **Smallest size:** 20 px for the emblem. Below that, home plate fills in, so the favicon uses its own drawing (below).
- **Logo / Favicon** `159:10756` (added 2026-10-25): the emblem redrawn for 16 px, in `logo/emblem` orange on a `logo/background` green tile with 3.6/16 rounded corners.
  - Redrawn, not scaled: thicker arms, a bigger home plate and wider gaps between them, so the gaps stay open at 16 px.
  - Exports: PNG at 16, 32 and 48 px, plus SVG.
  - Use it only where the icon is 48 px or smaller (browser tabs, bookmarks). Everywhere else, the logo stays today's emblem.
  - Chosen from five options on the Archive page ("Exploration — Favicon"): today's emblem scaled down, heavier strokes, plate only, solid diamond, and the green tile in two versions.
- **Logo / App icon** `124:7448`: a brand-green tile with the emblem spanning 49.8% of it, as in the master.

### Rollout
- All 54 inline wordmarks were replaced with instances: 37 on Viewer, 4 on Stress test, 13 on Archive.
- Both recap share images now use brand green (`logo/background`).
