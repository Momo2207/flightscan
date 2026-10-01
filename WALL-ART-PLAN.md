# Wall art release: implementation roadmap

These six changes share the existing delayed playback, route cache and local sighting history. The relay and aircraft polling stay unchanged.

Status: all six implemented in app build `2026-10-01.vercel.19`. Verification passed 171 unit tests, 73 frontend integration checks, browser layouts from 320px to 4K and a real-map check using 20 OpenFreeMap tiles. Deployment instructions are in `SETUP.md`.

| Step | Change | Implementation | Acceptance check |
| --- | --- | --- | --- |
| 1 | Gallery composition | Compact location and clock; hide coverage, timezone and rotation copy from the wall; reserve a slim sidebar beside the map. Keep those controls in Settings. | Aircraft canvas never sits behind the sidebar. Landscape, portrait and narrow screens fit. |
| 2 | Quiet cartography | Render OpenFreeMap/OpenMapTiles vector data on the existing canvas. Subtle woodland and settlement shapes, clearer water, faint major roads and a small collision-free set of city/town labels. Retain OpenStreetMap raster fallback and required credits. | Genuine geographic data, bounded visible-tile requests/cache, graceful failure independent of aircraft feeds. |
| 3 | Travel card | Stable regions for airline, callsign, orange rotating route, silhouette, model/registration and altitude/speed. Remove hex, repeated type code, extra metrics and decorative footer copy from the wall card. | Long names and both route presentations fit without moving other sections. Normal tracker details remain available. |
| 4 | Focus and trail | Replace the hard selection ring with a soft halo. Fade the old focus into the new one with the card. Show a thin fading trail for the featured aircraft using recorded delayed positions only. | No persistent old labels, no future or invented points; reduced motion changes immediately. |
| 5 | 24-hour journal | Slow the loop, widen edge fades, group airline/callsign/route/model, remove row dividers and repeated identifiers. Keep first/last seen and repeat-sighting counts. | Smooth wraparound and pause/manual controls; history and daily exports retain their original data. |
| 6 | Evening atmosphere | Optional daylight-following surface colours using an offline solar-position calculation at the display location. Gently warm at sunset and lower surface luminance at night. Fixed appearance overrides it. | Both themes and all wall layouts work; aircraft spectrum and route accent do not change; no new timer or external weather/geolocation request. |

## Implementation order

1. Add editable gallery CSS and canvas helpers to the self-contained build pipeline.
2. Add gallery cartography and atmosphere controls to Settings, persistence and setup links.
3. Connect card, focus, journal and canvas presentation to those helpers.
4. Test solar calculations, vector decoding, request cancellation/cache limits, focus timing and settings integration.
5. Verify actual browser layouts at 320px through 4K, both themes, all wall modes and reduced motion.
6. Package the complete source tree with deployment notes and this roadmap.

## Boundaries

The sunrise calculation adjusts app surfaces, not hardware brightness. The terrain treatment depicts real land cover rather than invented relief. Missing aircraft routes remain empty. Minimalist mode remains map-free. Map-source attribution stays visible. No account, API key or new relay setting is needed.

## Primary references

- [OpenFreeMap quick start](https://openfreemap.org/quick_start/)
- [OpenFreeMap tile endpoints and attribution](https://github.com/hyperknot/openfreemap)
- [OpenMapTiles schema](https://openmaptiles.org/docs/schema/)
- [Mapbox vector tile specification](https://github.com/mapbox/vector-tile-spec)
- [NOAA solar-position equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)


## Build 20 refinements

Implemented in app build `2026-10-01.vercel.20`. Verification passed 180 unit tests and 73 frontend integration checks. Browser checks covered dense aircraft overlap, complete route-name rotation, clean journey clearing, both themes and 320px–4K layouts. The relay remains build 11.

- Keep aircraft-only labels compact, adjacent and stable. Allow overlap, with higher observed altitude drawn above lower aircraft.
- Reduce the single featured map label to match the smaller typography.
- Replace the oversized wall card silhouette with route distance and an estimated whole-flight duration when cached route coordinates support it. Preserve clean spacing when information is absent.
- Retain orange rotating routes, both themes, delayed movement, aircraft category silhouettes on the map and the complete 24-hour journal/export behavior.


## Build 21: mapped airport surfaces

- Decode the existing `aeroway` vector layer.
- Render actual runway and taxiway paths with restrained solid strokes and supplied polygon outlines. Keep all other airport classes hidden.
- Preserve Midnight/Sunset materials, aircraft prominence, existing requests/cache limits and map-free mode.
- Verify runway references and path geometry using live Frankfurt map tiles, with decoding/style unit tests and browser checks.

## Build 22: noses aligned with movement

- Derive a separate display heading from the tangent of the same great-circle arc used for delayed positions. Keep reported track available for the normal tracker, details and exports.
- Use the display heading in both wall map renderers and the aircraft-only direction vector. Handle missing reports, taxiing, turns, date-line crossings and endpoints without reversing the nose.
- Ignore sub-five-metre jitter when choosing a movement angle; use reported heading for stopped positions and preserve the last display orientation during reception holds.
- Verification: 192 unit tests and 73 frontend integration checks pass. Browser checks confirm all four travel directions, missing-heading movement, stopped positions, held orientation and vector alignment in both layouts and themes. No relay changes or additional network requests.
