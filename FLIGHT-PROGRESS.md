# Flight progress and shared aircraft information

App release **2026-10-02.vercel.28**. Relay build 11 remains unchanged. Upload the full extracted project, including `design-system/` and `scripts/`, then redeploy. If upgrading from build 24 or earlier, close old Flightscan tabs once for the storage upgrade. Refresh the production page after redeployment.

## Display contract

| View | Main order | Secondary information |
| --- | --- | --- |
| Web Area / Fleet inspector | Airline, callsign, orange route and locations, model/registration, flight progress, altitude/groundspeed | Collapsed route estimates, phase, vertical rate, current-area sightings and technical reports; save/centre/Follow actions |
| Web results | Callsign + airline, route, type, registration, altitude, groundspeed | Optional vertical rate and position age; Callsign A–Z default |
| Web Follow | Compact Follow controls, map and common inspector | No redundant one-row results table |
| Wall Area / Fleet | Airline, callsign, rotating route, model/registration, optional route estimates, altitude/groundspeed | Estimates may be disabled; compact screens hide them first |
| Wall Follow | Airline, callsign, rotating route, model/registration, distance from departure/time airborne, altitude/groundspeed, distance to destination/estimated flight time | All six metrics shown by default, including compact layouts; route estimates can be disabled in Settings |
| Wall 24-hour journal | Airline, callsign and latest saved route, model/registration, First / Last / Sightings | One row per physical ICAO aircraft, repeated visits counted; no live metrics for departed aircraft |
| Aircraft only | Category silhouette, static identity, rotating altitude/speed/model/route | Optional followed-target progress pages; no map, large details panel or clock |

Centre distance and bearing are removed from visible tables, cards, tooltips and technical aircraft details. Geographic distance calculations remain for search coverage, route validation and internal prioritization. Old saved Nearest-first sort preferences migrate to Callsign A–Z. Missing airline/model/registration/route rows collapse. Required metric slots say Not available. Zero groundspeed and reported ground state remain valid values.

The primary distance field in web, Wall Follow and optional aircraft-only progress pages is **Distance from departure**: direct great-circle distance from the matching route origin to the currently displayed position. It uses the same delayed/held position as the wall marker and is independent of recording gaps. Unknown origin coordinates show Not available without substituting the partial track total.

Shared aircraft units and time zone are editable from Appearance or Wall Settings. Existing wall unit/time-zone preferences migrate without affecting geographic range units. Aviation uses ft / kt / NM / ft/min; Metric uses m / km/h / km / m/s. Live altitude rounds to 100 ft or 10 m; speed and travel distance use whole units; elapsed time uses whole minutes. Routes remain thin orange. Web locations are static, wall route aliases rotate every eight seconds.

## Position evidence

`FlightProgressStore` consumes each successful normalized poll before presentation filters and wall sampling. It records physical flight sessions by ICAO identifier and observation time. A callsign change does not reset the physical session; a registration reassignment or reception discontinuity beyond 30 minutes creates a new partial session.

Ground followed by two fresh airborne reports confirms a takeoff. The timing interval is last ground through first airborne report. The counter starts at that first airborne report. Distance sums accepted consecutive airborne great-circle segments, excluding taxiing. Two ground reports finalize landing and stop elapsed airborne time. A later observed ground-to-air transition creates a new flight.

Position gaps beyond 120 seconds break the distance sum without bridging missing travel. Departure time can remain known while distance coverage becomes partial. Duplicate/late reports add nothing. Impossible jumps are rejected using the same 650 m/s plus 1 km tolerance as wall playback.

| Evidence | Internal recorded-track label | Visible time label |
| --- | --- | --- |
| Observed takeoff with continuous accepted airborne segments | Distance covered | Time airborne |
| Observed takeoff followed by a reception gap | Observed distance | Time airborne |
| Aircraft first observed after departure | Observed distance | Time observed |
| First position with no distance segment | Not available value | Time observed, 0 min |
| No matching flight/identity/position evidence | Not available value | Not available value |

The track labels above remain internal; they no longer supply the primary distance displayed on cards. Web metrics use the accepted observation timestamp. Wall metrics use the displayed interpolation timestamp; held icons use their last real observation. Counters never advance from the computer clock while a signal is held. The same flight and scene time produce the same figures in DOM and canvas.

The existing live relay cannot supply full past flight history. This release adds no history account or credentials. Area/Fleet retain airport-to-airport distance. Follow adds great-circle distance from the displayed position to the destination airport and estimated total flight time using the existing nominal cruise model. These remain separate from the stored flown track and actual airborne time. Missing inputs hide only the affected route figure; losing/changing a route clears the old figures. Explicit Off preferences remain respected; legacy All aircraft cards preferences migrate to On. Technical coverage explanations remain in About.

## Persistence

The existing `flightscan-sightings-v2` IndexedDB database upgrades from schema 1 to schema 2, preserving `areas`, `visits`, `reports`, `meta` and `leases`. New `flightRecords` metadata and `flightPoints` batches of 100 observations hold flight progress. They are independent of area history and area reset cutoffs.

The existing recording owner writes flight progress. Reader tabs forward normalized observations through the existing BroadcastChannel. The writer deduplicates them and broadcasts updates, allowing reloads and mode switches to retain the same totals. Position-only coordinates from old journals anchor partial observation time without manufacturing departure or altitude evidence.

Flight storage is bounded to a 48-hour observation horizon, 10,000 retained points per physical session and a conservative 32 MiB record/point budget. Compaction keeps cumulative distances and gap flags; completed flights are evicted first. Pruning uses existing polling and recording-heartbeat callbacks, without an extra polling loop. A failed storage transaction restores dirty records for retry. When IndexedDB is unavailable, progress remains session-only and the recording status reports it in Settings.

## Editable sources

| File | Responsibility |
| --- | --- |
| `design-system/flight-progress.js` | Physical flight sessions, observation acceptance, progress at scene time, retention and partial-history seeding |
| `design-system/aircraft-info.js` | Field registry, view profiles, shared identity/metric snapshots, unit/time-zone preferences |
| `design-system/aircraft-info.css` | Unified hierarchy, Follow progress band, responsive layouts and optional result columns |
| `design-system/wall-minimal.js` | Adjacent labels, stable cycling, optional progress pages and vector clipping |
| `design-system/wall-journey.js` | Route geography, Follow destination distance, whole-flight estimates and visibility preference |
| `index.html` | Existing poll, storage writer, selection/actions and view integration |
| `scripts/build-design.mjs` | Embeds editable CSS/JS and fonts into the standalone HTML |

Use `npm run build` after changing design sources. `npm test` covers flight lifecycle, partial records, delayed scene time, gaps, held signals, compaction, units and the existing route/playback/export systems. Browser verification also covers real IndexedDB upgrades, preserving reports, reader-tab forwarding, reloads, area-reset independence and layouts from 320 px phones to 4K screens.
