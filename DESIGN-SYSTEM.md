# Flightscan design system

Implemented in app build `2026-09-30.vercel.17`. The flight relay remains build 11.

## Themes

| Role | Midnight | Sunset |
| --- | --- | --- |
| Background | `#05080F` | `#F5EBDD` |
| Content surface | `#0C1424` | `#FFF7EC` |
| Elevated surface | `#13223A` | `#EAD6C4` |
| Main text | `#F2F7FF` | `#302219` |
| Secondary text | `#A7B7CE` | `#725E50` |
| Primary action | Ice blue `#70C5FF` | Burnt orange `#9F4E23` |
| Action text | Deep ink `#061322` | Warm white `#FFFAF3` |
| Ambient light | Cobalt, cyan, ice | Apricot, peach, amber |

Appearance follows the device's light preference on the first visit. An explicit choice wins on later visits. The wall display keeps its own theme, and exiting it restores the tracker theme. Existing `night` and `paper` storage values and setup links continue to work; only their visible names change.

## Typography

The implementation bundles **Roboto**, exposed in CSS as `Flightscan Sans`, at six genuine weights: Thin 100, Light 300, Regular 400, Medium 500, Bold 700 and Black 900. These local font files replace the planned Inter dependency to keep the delivered HTML self-contained. The original font metadata and Apache 2.0 license are retained. No runtime font service is contacted.

- Black: location headings, travel headlines and route airport codes.
- Bold: callsigns, airlines and active controls.
- Medium: controls and compact aircraft labels.
- Regular: descriptions and supporting information.
- Light: large numeric metrics.
- Thin: the oversized wall clock only.

Small labels never use Thin. Numeric metrics use tabular figures. Map canvas labels share the same font family as the panels and repaint after font loading.

## Materials and layout

Control glass uses restrained blur, soft shadows and a fine illuminated edge. Content glass is more opaque so text remains legible. Map labels use compact, high-opacity surfaces with nine-pixel corners. Large panels use 26-pixel corners and controls use 12-pixel corners. Touch controls are at least 44 pixels high. The shared spacing rhythm uses 4, 8, 12, 16, 24, 32, 48 and 64 pixels.

Midnight uses blue light on near-black surfaces. Sunset uses cream and peach glass over a warm beige background. The normal inspector and wall feature card give airport-code routes a stronger hierarchy. The normal tracker collapses secondary filters; Explore fleet opens them automatically. Mobile retains the aircraft bottom sheet.

Area, Fleet and Follow wall layouts use the same materials. The 24-hour layout keeps its map and upward-scrolling sightings list, including routes, first/last seen and repeated sightings. Aircraft-only mode retains a plain background, silhouettes, altitude/callsign labels and heading vectors. Optional route labels remain configurable.

The Flight spectrum stays independent of UI accent colours. Its altitude/vertical-rate mapping, delayed timeline, smoothing and reception holds are unchanged. Selection outlines remain separate from the spectrum.

## Effects

Full glass and Reduced effects are available in Appearance and Wall Settings. The effects choice is shared; colour themes remain independent. Reduced effects use opaque surfaces and suppress the optional flowing background. Static gradients are the default. Flowing gradients use a 36-second cycle and do not move the map or labels. Aircraft-only mode always keeps a plain background.

Device reduced-motion preferences and the wall's explicit Reduced motion setting stop decorative animation. Browsers without backdrop-filter support use opaque surfaces. Button transitions are around 200 ms, colour transitions around 500 ms, and the existing wall-card crossfade remains 900 ms.

## Editable sources

- `design-system/ui-tokens.css`: semantic colours, materials and shared wall aliases.
- `design-system/ui-components.css`: tracker, dialogs, typography and responsive components.
- `design-system/ui-modes.css`: Area/Follow/Fleet controls and filters.
- `design-system/wall-display.css`, `wall-log.css`, `wall-camera.css`: wall layouts.
- `design-system/routes.css`, `aircraft-symbols.css`, `wall-colours.css`: shared route and aircraft presentation.
- `design-system/ui-wall.css`: wall glass treatments and responsive refinements.
- `design-system/ui-theme.js`: saved preferences, theme synchronization, shared canvas palettes and cached tile styling.
- `assets/fonts/`: the source WOFF2 files and their license.

`npm run build` assembles those sources into the existing `index.html`, then copies that self-contained HTML to `public/index.html`. It preserves the existing flight logic, relay configuration and inline datasets. If you maintain only a single GitHub Pages HTML file, use the compiled `index.html` directly. Changing only CSS colours does not automatically change canvas colours: edit the corresponding `UI_PALETTES` role in `ui-theme.js` too.

## Verification

The release passed 141 existing data/relay tests, eight new appearance tests and 73 existing frontend integration tests. Chromium checks cover 320×740, 390×844, 1366×768, 1920×1080, 1080×1920 and 3840×2160 in both themes. They verify genuine font loading, settings widths, no page overflow, route display, unclipped wall cards and sightings rows, aircraft-only labels, Follow zoom, preference persistence, and no new external font requests or browser errors.

Browser checks use controlled feed and map fixtures. They do not certify availability of live third-party flight providers or performance on a physical display. The relay, API limits and authentication settings are unchanged.
