# Flightscan design system

Implemented in app build `2026-10-01.vercel.19`. The flight relay remains build 11.

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
| Wall route accent | Soft orange `#FFB376` | Burnt orange `#9F4E23` |

Appearance follows the device's light preference on the first visit. An explicit choice wins on later visits. The wall display keeps its own theme, and exiting it restores the tracker theme. Existing `night` and `paper` storage values and setup links continue to work; only their visible names change.

## Typography

The implementation bundles **Roboto**, exposed in CSS as `Flightscan Sans`, at six genuine weights: Thin 100, Light 300, Regular 400, Medium 500, Bold 700 and Black 900. These local font files replace the planned Inter dependency to keep the delivered HTML self-contained. The original font metadata and Apache 2.0 license are retained. No runtime font service is contacted.

- Black: normal-tracker headings and route airport codes.
- Bold: callsigns, airlines and active controls.
- Medium: controls and compact aircraft labels.
- Regular: descriptions and supporting information.
- Light: large numeric metrics and wall routes (weight 300).
- Light: compact wall location/clock and journal timing.

Small labels never use Thin. Numeric metrics use tabular figures. Map canvas labels share the same font family as the panels and repaint after font loading.

## Materials and layout

Control glass uses restrained blur, soft shadows and a fine illuminated edge. Content glass is more opaque so text remains legible. Map labels use compact, high-opacity surfaces with nine-pixel corners. Large panels use 26-pixel corners and controls use 12-pixel corners. Touch controls are at least 44 pixels high. The shared spacing rhythm uses 4, 8, 12, 16, 24, 32, 48 and 64 pixels.

Midnight uses blue light on near-black surfaces. Sunset uses cream and peach glass over a warm beige background. The normal inspector retains bold route codes. Wall route codes and full locations use lighter orange typography, secondary to the callsign. The normal tracker collapses secondary filters; Explore fleet opens them automatically. Mobile retains the aircraft bottom sheet.

Area, Fleet and Follow wall layouts use the same materials. A single compact location/clock line sits above a borderless rounded map and a slim, separately reserved glass sidebar. Coverage, filters, timezone and rotation descriptions stay in Settings. The card has stable regions for airline, callsign, orange route, large silhouette, model/registration and altitude/speed. Hex IDs, repeated type codes and the extra card metrics are removed from the wall composition; normal tracker details remain available.

The 24-hour layout keeps its map and upward-scrolling sightings list. Rows group airline, callsign, route and model, with compact first/last seen and repeat-sighting counts. There are no row dividers. The loop moves at 12 CSS pixels per second with broad edge fades; pause and manual-scroll controls remain available. Aircraft-only mode retains a plain background, silhouettes, altitude/callsign labels and heading vectors. Optional route labels remain configurable.

The Flight spectrum stays independent of UI accent colours. Its altitude/vertical-rate mapping, delayed timeline, smoothing and reception holds are unchanged. The featured map aircraft uses a soft radial halo instead of a hard selection ring. Incoming/outgoing focus weights share the card's 900 ms fade interval. Only the featured aircraft has a thin fading trail, made from recorded observations ending at the delayed playback clock. Its label changes with the selected aircraft and is removed on the next repaint. Log mode has no featured halo or label.

## Gallery map and daylight

Gallery cartography uses actual OpenFreeMap vector tiles with the OpenMapTiles schema. Water and woodland form the main geographic texture. Roads stay faint and a maximum of eight city/town names are placed with collision avoidance, including aircraft clearance. Buildings, POIs and road-name labels are omitted. This is land-cover styling, not invented elevation or hill shading. A small canvas renderer avoids adding a second map engine. Vector geometry is decoded once per tile and rendered into cached canvases; only visible tiles are requested, at most four at a time and 160 retained. Source metadata resolves versioned tile URLs so HTTP caching cannot keep a `latest` alias indefinitely. Requests include response-body reading in their deadline and failures cool down before retrying. OpenStreetMap raster tiles are the independent fallback; Street map remains a selectable option. Required map credits stay visible.

Follow daylight is optional and uses NOAA's solar-position equations offline at the display's chosen location. A continuous twilight blend gently warms surfaces near sunset and reduces surface luminance at night. It uses the existing wall heartbeat, checks at most every 20 seconds, and adds no weather or geolocation request. Fixed appearance is the default and overrides the adjustment. Both themes and all wall layouts are supported; the minimalist canvas retains a plain background. Text, aircraft spectrum and orange route accents are not recoloured. This changes app surfaces, not device backlight brightness.

## Wall route rotation

Airport abbreviations show first, then full locations, with eight seconds per view and a 500 ms crossfade. City names are preferred over airport names; unknown locations retain their airport code. The feature card, 24-hour list and optional aircraft-only route labels share this treatment. Reduced motion swaps text without a fade. The normal tracker and exported sightings retain their original route data and presentation.

Both versions reserve the same geometry. Card/list text wraps and fits where possible without ellipsis. Very narrow cards give the heading the full width, moving the small silhouette to the airline row. Canvas labels measure both versions and reserve the larger wrapped layout, so alias changes do not move labels. There are no new timers, network calls or changes to position playback. A changed aircraft, callsign or endpoint starts a new reading cycle; metadata refreshes do not reset it. Per-aircraft presentation state is bounded to 512 entries and clears on wall exit.

Each DOM route exposes one stable accessible description containing codes and full locations. Its two visual strings are hidden from assistive technology to avoid duplicate or repeated announcements. No live region is added.

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
- `design-system/wall-gallery.css`, `wall-gallery.js`: gallery composition, quiet map rendering, focus timing and offline daylight atmosphere.
- `design-system/ui-theme.js`: saved preferences, theme synchronization, shared canvas palettes and cached tile styling.
- `design-system/wall-routes.js`: route alias timing, stable DOM presentation and wrapped canvas route labels.
- `assets/fonts/`: the source WOFF2 files and their license.

`npm run build` assembles those sources into the existing `index.html`, then copies that self-contained HTML to `public/index.html`. It preserves the existing flight logic, relay configuration and inline datasets. If you maintain only a single GitHub Pages HTML file, use the compiled `index.html` directly. Changing only CSS colours does not automatically change canvas colours: edit the corresponding `UI_PALETTES` role in `ui-theme.js` too.

## Verification

Verification passes 171 included unit tests (141 existing data/relay, eight appearance, eleven route presentation and eleven gallery tests) and 73 frontend integration checks. Chromium checks cover 320×740, 390×844, 1366×768, 1920×1080, 1080×1920 and 3840×2160 in both themes. They check font loading, settings widths, no page overflow, unclipped wall cards and sightings rows, aircraft-only labels, Follow zoom and preference persistence. Focused checks cover route cycling, typography, reduced motion, steady card geometry, saved gallery/daylight options, map failure fallback, journal pacing and unchanged route/aircraft colours through twilight. The renderer was also verified against 20 real current OpenFreeMap tiles around Offenburg in both themes.

Browser checks use controlled feed and map fixtures. They do not certify availability of live third-party flight providers or performance on a physical display. The relay, API limits and authentication settings are unchanged.
