# Airspace Wall Display

App release `2026-10-02.vercel.28`, with relay `2026-09-30.vercel.11`. Upload all extracted files and folders for this update, including `design-system/` and `scripts/`, then redeploy. The complete six-part wall-art roadmap is in `WALL-ART-PLAN.md`. Midnight and Sunset retain their glass materials, gradients and embedded fonts. Thin orange routes still alternate airport codes and full locations every eight seconds. The aircraft-only layout stays plain and uncluttered.

The new Gallery map style gives water and land cover more presence, with faint roads and a small set of town names. It uses actual OpenFreeMap/OpenMapTiles geographic data and retains map attribution and a raster fallback. Choose **Map style → Street map** to restore the previous map treatment. **Atmosphere → Follow daylight** gently warms surfaces near sunset and lowers their luminance at night; **Fixed appearance** keeps your chosen theme constant and is the default. The calculation is local to your chosen display location. It does not change aircraft spectrum colours, orange routes, normal tracker preferences or the screen's hardware brightness.

Flight spectrum colours remain optional and use the existing delayed playback. The log records separate visits and flight segments in IndexedDB, displays available routes plus first/last seen and repeat sightings, and offers daily CSV/XLSX exports. The observation rectangle follows the visible 24-hour map by default and can be kept fixed in Settings, independently of camera zoom. See `SIGHTINGS-EXPORTS.md`. If upgrading from build 10 or earlier, also update `api/relay.js`; preserve Vercel credentials and the public production URL.

## Airport infrastructure

Gallery maps now render the existing OpenFreeMap/OpenMapTiles `aeroway` geometry. Runways appear from tile zoom 10; taxiways appear from zoom 12. Runways have a stronger solid stroke, taxiways a finer quieter stroke, in muted blue-grey for Midnight and warm brown-grey for Sunset. Aircraft and their labels remain above the map geometry. This applies to every mapped airport in the visible tiles, including Follow and 24-hour maps.

The airport overlay filters to `runway` and `taxiway` only. It does not add airport-wide shading, apron/gate shapes, terminal buildings, gradients or glows. Supplied polygons retain their geometry; supplied centre-lines use a decorative screen-width stroke, not a fabricated physical width or pavement edge. Source detail and positional accuracy depend on the map data and zoom. Street map retains its existing raster appearance; Aircraft only remains map-free. No new map endpoint, key, relay operation or flight request is added.

The source was checked against 28 actual Frankfurt tiles: all four runway references (18, 07L/25R, 07C/25C and 07R/25L) and hundreds of taxiway path fragments were present. Both themes were visually checked with the mapped geometry.

## Journey figures

Follow shows **Distance from departure** from the matching origin airport to the currently displayed position. This is a direct geographic measurement rather than a sum of recorded track segments, so starting observation mid-flight or missing reports does not reduce it. No origin coordinates means Not available; partial observed distance is not substituted. Web cards and optional aircraft-only Follow progress pages share this definition.

Area and Fleet cards show the great-circle distance between the route’s two airports. Follow instead shows **Distance to destination**, measured from the aircraft’s displayed position to the destination airport. Delayed and held positions use the same position as the marker. Both use km or NM according to shared aircraft units; neither is the observed flown track. Estimated flight time uses a nominal jet-category cruise speed and a 20-minute climb/descent allowance, rounded to five minutes. It does not use current taxi speed or show a schedule, arrival time or remaining time. Missing coordinates hide only the affected figure; unmodelled categories keep time hidden. Follow shows distance to destination and estimated flight time below altitude/groundspeed, alongside the distance from departure/time airborne. These six metrics remain visible in compact layouts. **Route distance & flight estimates → Off** hides the extra pair when desired. Methodology stays in About. These calculations use the existing cached route and add no requests.

## What is included

- Midnight and Sunset themes, landscape and portrait layouts.
- Compact location/clock header, a borderless rounded map, and a separately reserved travel card with airline/logo, callsign, route, model, registration, route distance, estimated flight time, altitude and groundspeed. Coverage and timezone descriptions remain in Settings.
- Original vector silhouettes shared by the normal map and wall map. Categories distinguish wide-body, narrow-body, regional, business/private and military jets, military transport jets, turboprops, propeller aircraft, helicopters and gliders. These are category drawings, not exact model illustrations.
- The wall card uses compact journey figures instead of an oversized aircraft illustration. Figures appear only when airport coordinates are available; unsupported aircraft categories keep distance alone. Changing aircraft or losing a route clears the previous figures. The normal inspector uses the shared information hierarchy.
- The upper-left map badge, duplicated type code, hex identifier, extra card metrics and rotation prose are removed from the composition. The footer retains the aircraft count and source credit. Delay remains configurable in wall settings and explained in About.
- Area and Explore fleet views keep the map fixed and rotate the featured aircraft every 45 seconds. Follow uses the selected ICAO identifier and a gentle delayed-position camera.
- Pin/unpin and next/previous aircraft controls. Controls hide after five seconds and return on pointer, touch or keyboard activity.
- In the Map & panels layout, only the featured aircraft has a map label, soft halo and thin fading recorded-position trail. Changing the selection removes the old label on the next repaint; focus weights fade with the incoming card. Reduced motion changes immediately. The log map has no featured label or halo.
- Delay choices of 30, 60, 90 and 120 seconds. Default: 90 seconds.
- Viewing-distance and information-density settings, aviation/metric units, time zone, optional active hours, optional screen wake lock, and opt-in startup on this browser.
- Local settings and privacy-conscious display-setup links. No new network requests are created by card rotation, filters or animation.
- **24-hour log** is a separate map-and-list layout, with a slower continuous upward loop, broad edge fades and no row dividers. Airline, callsign, orange route and model are grouped above compact first/last seen and repeat-sighting counts. Pause/manual controls and exports retain their behavior.
- Routes appear quietly in the featured/Follow card, saved sightings and aircraft-only cards. Route pages in the aircraft-only cycle can be turned off separately.
- Wall routes alternate airport codes and full locations every eight seconds, with thin orange lettering and a soft crossfade. Reduced motion preserves the text switch without animation. Both aliases reserve the same space, so the aircraft card does not move as the route changes. Available city names are preferred; airport names are used when a city is missing, and unknown names retain their code.

Choose Area, Airline & aircraft, Follow aircraft or 24-hour log inside wall settings. The settings initially inherit the normal view; after applying they remember their own centre, coverage and filters. Use the current app area or a saved view as the map centre. Lufthansa + A320, All airlines + A320, and Lufthansa + All types remain independent AND combinations. Searches remain regional; this is not a worldwide fleet index. Airline/operator matches are callsign inferences, not verified ownership or booking flight numbers. Route matching limitations are explained in About.

Open **Aircraft symbols** in wall settings for the visual key. Classification uses the reported ICAO type and bundled airframe/engine metadata. Business and military silhouettes describe a design category; they do not verify ownership or current use. A Beechcraft B350 uses a twin-turboprop silhouette even when military operated. Unclassified jets retain a generic jet shape; unknown types use a neutral marker. Wall silhouettes point along the actual delayed movement path, including when a reported heading is missing or inconsistent. Displacements below five metres fall back to the reported heading to avoid turning on position jitter. A stopped aircraft with no reported heading retains its last displayed orientation. If neither movement nor a usable heading is available, the marker is a dot. Reception holds freeze the nose with the position. Symbol selection adds no requests or external assets.

## Flight spectrum colours

Open **Settings → Aircraft colours** and choose **Flight spectrum**. Classic is the default and keeps the existing wall appearance. The option works with Area, Fleet, Follow and 24-hour modes, in both Map & panels and Aircraft only layouts. A small palette preview appears in Settings; no legend or extra technical text is added to the tracker. The choice is saved locally and included in setup links with `wcolour=spectrum`.

Ground reports are blue. On climb, the colour follows blue → cyan → green on a shared 0–40,000 ft altitude scale. Level flight is green at any altitude. On descent, the same height scale follows green → yellow → orange → red, then gently fades to blue after a reported ground state. This is a decorative encoding of observed altitude and vertical rate, not height above local terrain, confirmed touchdown or flight-plan phase. Aircraft above/below the scale clamp at its ends. Barometric values are preferred; numeric geometric altitude/rate supply missing values.

The colour engine uses the delayed playback clock and interpolated telemetry, not the newest live report or network-response time. OKLab interpolation blends palette colours; changes in flight state settle over about eight seconds. A 200 ft/min entry threshold and 100 ft/min exit threshold prevent small rate changes from flickering between states. Held aircraft freeze their last colour. Missing telemetry fades back to the classic colour. Old colour states expire with playback retention, and delay resets or reconnects clear them.

Night and Paper palettes preserve the same colour sequence with different brightness for contrast. Only silhouettes receive spectrum colours; labels, short direction arrows, selection rings, side cards, list symbols and trails keep their existing styling. Reduced motion still uses the existing slower playback updates. The option needs no additional data requests, accounts or relay changes.

## Zoom and aircraft-only layout

**Area / 24-hour zoom** chooses automatic width fitting or a custom zoom from 4 to 15 in half-level steps. **Follow zoom** is saved separately and defaults to 9. Higher numbers bring the view closer. The on-screen controls provide **+**, **−** and a reset: **Fit area** restores the configured regional width, while **Reset zoom** restores Follow to 9. Settings are remembered on this browser and included in display setup links.

Custom regional zoom fixes the Mercator scale; resizing or changing the layout changes the visible geographic area. Automatic zoom instead preserves the configured width. Both recalculate the buffered collection area and respect the relay’s coverage limit. A requested zoom may be tightened to fit that limit; the controls show the actual zoom and disable further zoom-out at the limit. Regional zoom changes debounce the existing poll schedule, cancel obsolete responses and retain tracks and the delayed clock. Follow zoom only adjusts the camera scale and keeps the same ICAO query.

The 24-hour log matches its observation rectangle to the actual map canvas by default. Zoom changes apply immediately; resize and layout changes settle before updating the footprint. Earlier area histories stay available. A new footprint reuses previously recorded positions that actually fall within it, preserving timestamps and saved routes, without inventing coverage or fetching historical flights. Earlier logs with no coordinates remain separate imported histories. Turn off **Recording & daily exports → Match the visible map in 24-hour mode** to retain fixed geometry; **Use current map area for recording** then changes it explicitly. Other regional modes record the monitored area only when their actual query covers it; otherwise coverage gaps are stored.

Set **Wall layout → Aircraft only** for a full-screen plain background. It works independently of the tracking mode. There are no underlying tiles, header, clock, sidebar, trails, compass or selected-aircraft halo. Every visible aircraft has its existing category icon and a compact card with a fixed callsign. The detail area cycles available altitude, groundspeed, aircraft type, route codes and full locations every eight seconds. Only one detail is shown at a time, with a 500 ms crossfade; Reduced motion switches immediately. Missing pages are skipped, zero speed and Ground remain valid, and an aircraft with no details shows “Details unavailable.” Missing callsigns retain “No callsign”; registrations are not substituted. Altitude and speed respect aviation/metric units; geometric altitude is used only when barometric altitude is absent.

Available routes occupy two consecutive pages in the detail cycle: thin orange codes such as **FRA → LIS**, followed by full locations such as **Frankfurt → Lisbon**. Full names and aircraft types wrap; card dimensions reserve enough space for every page and stay fixed while cycling. Callsigns do not crossfade. Changing telemetry values does not restart the cycle; a different callsign or route clears stale pages. **Show routes in aircraft-only labels** starts on; turn it off in wall settings to omit route pages while retaining available altitude, speed and type. Saved explicit choices and setup links with `wroute=0` remain respected. No route lines are drawn across the map. The controls retain route-source attribution; route limitations are explained in About.

A short, fixed-length arrow shares the nose direction derived from the displayed interpolation path. Adjacent card placements favour a clear vector; any remaining vector intersections are clipped outside all cards with four pixels of clearance. This also protects overlapping cards and edge placements without pushing labels farther from their aircraft. Its length is decorative, not a speed forecast. Arrows are omitted for ground, stationary, held or unknown-heading positions. Held labels say “held.” Compact labels use only adjacent placements, usually within 18–26 CSS pixels of the aircraft. They may overlap in dense traffic instead of spreading into distant rings. The label and icon are drawn together, in increasing observed barometric altitude, with geometric altitude used only when barometric altitude is absent. Ground is zero; unknown altitude is below known altitude; ties use the ICAO identifier. Higher aircraft and their labels are drawn above lower groups. A previous adjacent placement remains stable while it fits the viewport. Labels stay within the screen and are cleared on every repaint.

Night and Paper themes, viewing distance, smooth delay, reduced motion and rest hours still apply. Regional sightings continue to accumulate while the list is hidden. Auto-hiding controls retain provider attribution; a short startup or feed-status message appears only when no aircraft are visible. Returning to **Map & panels** restores the map and the appropriate card or log. Aircraft-only rendering makes no map-tile requests, including on automatic startup.

## Rectangular coverage

**Fit map rectangle** is the wall default. With automatic zoom, set the visible width in km or NM. The height is calculated from the actual map canvas, excluding the header, sidebar and footer, using its Mercator projection. Fractional zoom maintains that width as the panel changes shape. The header reports the resulting geographic width and height; no circular boundary is drawn. Circle remains an option, and the normal interactive Area mode retains its existing radius behavior.

Collection and display are separate. A larger invisible rectangle supplies the history buffer. ADS-B providers receive a circle covering its corners; OpenSky receives its bounds, split across the date line when necessary. The current observation may already be offscreen while its older interpolated position is still visible. Only interpolated positions inside the visible scope count or become featured. Histories outside it remain available for movement across edges.

The margin on every side allows 1,200 km/h for the selected delay, 60 seconds between slow-feed responses, a 50-second response allowance and 15 seconds of jitter. At the default 90-second delay this is about 72 km. It is a collection allowance, not a flight prediction or a guarantee during missing reports. A view whose expanded corners would exceed the relay's approximately 450 km radius limit is reduced until it fits, with a visible note. The supported requested width is 5–800 km; the actual limit depends on aspect ratio and latitude.

Resize, orientation and fullscreen changes recompute geometry, invalidate any response for old bounds, and debounce scheduling for 250 ms. They retain overlapping histories and respect the existing polling interval and provider cooldowns. The animation clock is not reset by resizing. Newly exposed areas need fresh buffered observations before all aircraft there can appear.

## Follow an aircraft

Choose **Follow aircraft**, enter a tail number, a current callsign or a six-character ICAO ID, select **Find aircraft**, check the returned identity and choose **Follow aircraft**. Case and spaces are normalized; common registration prefixes can be entered with or without a hyphen. Current received observations are checked first, including the normal map and recent playback observations. This local match works during a network update or provider cooldown. Stale observations are excluded and the newest report for each ICAO takes precedence.

For example, **EZY83LT is a callsign**, so sending it to a provider's registration endpoint cannot reliably find the aircraft. The app now resolves it from current flight data and tracks the associated ICAO ID. A subsequent callsign change does not change the target. A callsign not currently received requires the registration or ICAO ID instead. A manually entered ICAO ID can be tracked without a registration lookup; availability is checked by the normal poll loop. Multiple distinct exact matches require an explicit choice.

The registration search uses the existing adsb.fi and ADSB.lol relay providers, then tracking uses the resolved six-character ICAO. OpenSky can provide positions for that known ICAO, but its states API does not resolve registrations. A successful empty response means no currently reporting aircraft was found, not that the tail number is invalid. A failed or rate-limited provider is reported separately. Lookup errors use the same provider cooldowns as normal polling, and an obsolete lookup is discarded if its input changes or the dialog closes.

Recent successful lookup results are reused for ten minutes; empty results for one minute. A selected registration-to-ICAO match is valid for 24 hours after confirmation. New tracking reports bearing the same registration renew that confirmation, so a reporting aircraft does not require daily manual reselection. If no registration report confirms it within 24 hours, find it again in settings. A conflicting reported registration stops tracking and requests confirmation. Cached positions and maps are never used as evidence that a registration is still assigned to an aircraft.

The followed aircraft is not constrained by the original area, airline, type or saved-only filters. Camera, marker, trail and card all use the delayed playback clock. Leaving wall mode restores the normal app's previous mode, area, filters and camera. Wall settings remain saved separately. If reception stops, the normal held-position/fade behavior applies; no future motion is invented.

Provider reference: [adsb.fi endpoints](https://github.com/adsbfi/opendata/blob/main/README.md), [ADSB.lol API](https://api.adsb.lol/docs), [OpenSky states API](https://openskynetwork.github.io/opensky-api/rest.html).

## 24-hour log mode

Choose **24-hour log · map & sightings** in wall settings. In landscape, the map fills the left side and the continuously scrolling list sits on the right. The normal title band and featured-aircraft card are removed from this composition. Location, a clock, unique-aircraft count and feed status sit within the list panel. Portrait layouts stack the map above the list. Midnight and Sunset are both supported.

Each row shows an aircraft-category silhouette, model, inferred airline, callsign and registration when known. One ICAO ID produces one entry even after several passes or callsign changes. Different aircraft sharing a callsign remain separate entries. Missing metadata stays unknown; a previously reported type can survive a fallback feed that omits it. Airline names remain callsign inferences.

Each row shows the latest recorded flight's route when available, type, airline, callsign and a compact **First / Last / Sightings** line. First/last are actual position observations within the rolling 24-hour window, formatted in the chosen zone with a date prefix when needed. One aircraft remains one scrolling card; its separate visits and flight segments remain in the export.

Two fresh outside observations beyond a small boundary margin confirm exit; a subsequent inside report starts another visit. Missing signal creates a separate observation session after the configured interval, initially five minutes. These sessions are labelled sightings; the export distinguishes confirmed reentries from gaps. Callsign changes create flight segments without inflating geographic visits. Duplicate, stale and cached reports do not renew timestamps.

Available routes are captured from fresh observed aircraft as well as delayed markers. Successful snapshots stay attached to their matching historical segment after live-cache expiry or departure, and late accepted responses can enrich matching recorded evidence. An unknown or changed latest callsign does not display a prior flight's route. No historical API lookup is made.

Recording uses the existing regional polling loop, independently of airline/type filters. It cannot collect while closed, hidden, paused or resting, or during provider failure. Those gaps are recorded. No new competing poller or server-side archive is added. History uses IndexedDB on this frontend origin; `airspace-sightings-v1` remains untouched as migration backup. If storage is unavailable, in-memory recording and manual download remain available, with a short save problem state; automatic export requires persistent storage.

Settings contain **Recording & daily exports**, automatic map matching, the optional fixed-area action, recorded-area selector, area-specific reset, gap interval, CSV/XLSX format, automatic export switch, folder option on supported browsers, immediate download and completed-report history. Selecting an earlier area reviews, resets or downloads its history without moving the map or changing the current recorder. **Reset sightings for this area** deletes its observations, visits and imported rows; it leaves other histories and completed reports intact. Enabled daily periods for that area restart at reset time. Cached pre-reset positions and stale tabs cannot restore cleared observations. Periods are 24 elapsed hours from enabling export, with up to two minutes for finalization. Requests are deduplicated across tabs; sleep/restart recovery closes due reports from existing observations. Seven requested/saved reports per area are retained, alongside all pending/failed folder deliveries. See `SIGHTINGS-EXPORTS.md` for browser permissions and report contents.

The upward loop remains virtualized. Hover/focus pauses motion, controls provide paging, and reduced motion retains manual scrolling. Row height has increased to keep routes and timing readable across landscape, portrait, mobile and far-distance layouts.
## Route information

The featured and Follow cards show airport codes below the callsign, with city/airport names where there is room. Narrow screens keep the codes readable and reduce secondary text. Unknown results add no empty route section. The map stays focused on local aircraft; there are no long route paths, progress bars or inferred ETAs.

Routes come from the ADSB.lol callsign-and-position lookup and remain an inference. Only a unique, plausible two-airport result is displayed. Airport codes prefer IATA and fall back to ICAO. A route belongs to an observed ICAO/callsign episode; a callsign change or reception gap over 30 minutes starts another episode. Delayed markers and cards use the route matching their own observation, so a newer flight's route cannot appear on an older displayed aircraft.

Batch lookups have separate queues, cache, deadline and retry delays from position polling. The app submits up to four callsigns, at least 15 seconds apart; the relay uses individual ADSB.lol GET requests with at most two in progress. Positive results last ten minutes and unknown results five minutes. The whole relay batch is bounded to 20 seconds and the browser to 23 seconds. Route lookup failure leaves playback running and shows its specific error and code in About. Pausing, hidden tabs and rest hours stop route requests along with the display's other network work. **About → Look up likely routes** turns lookups off globally.

Successful routes are retained when another lookup in the batch fails or times out. Only failed callsigns are deferred unless the provider reports a quota or access restriction. Selected aircraft take priority, then aircraft that have not been looked up recently, so repeated failures cannot monopolize the queue.

Normal-view routes are reused for older matching observations in the recorded playback buffer. Recovery stops at unknown/different callsigns and closed episodes, and it does not change the delayed position or add a route request. Wider collection queries keep valid route answers ahead of unresolved cache entries. Area, fleet, Follow and 24-hour log use the same route identity checks, including in aircraft-only layout.

## How delayed playback works

The display time is wall-clock time minus the chosen delay. Every aircraft, trail and featured card uses that same timeline. Incoming observations are buffered by aircraft identifier; existing live snapshots are not overwritten with interpolated data.

The current providers supply observation timing: ADS-B reports combine the feed timestamp and `seen_pos`; OpenSky uses its last-position timestamp. Receiving a cached response does not make its positions newly observed. If a provider payload lacks its feed timestamp, the existing normalizer falls back to receipt time minus `seen_pos`; timing precision then depends on that payload. Repeated timestamps are deduplicated, out-of-order observations are sorted, and late observations cannot rewrite a segment already being played.

A marker moves along the shortest great-circle arc between two known positions. Headings use the short rotation through north. Numeric altitude, groundspeed and vertical-rate fields are interpolated only when both observations supply numbers. Missing values remain unknown. Identity/type/operator metadata belongs to the earlier observation until the later report is reached.

Intermediate positions and metrics are estimates between measured reports, not additional measurements. About explains the delayed/interpolated playback; only last-known positions and essential failures are labelled on the tracker. It does not extrapolate beyond the last known position and must not be used for navigation.

### Startup and sparse data

A newly seen aircraft needs two valid observations bracketing display time. On a fresh page, allow the selected delay plus approximately one normal feed interval. With the existing polling configuration, ADS-B requests normally start 30 seconds after the previous response and OpenSky requests 60 seconds after it. Response time, cooldowns and coverage can lengthen that interval. A 30-second delay may therefore pause frequently; 90 or 120 seconds provides more room for updates.

If the bracket runs out, a previously shown aircraft holds its last endpoint for at most 45 seconds of playback time and fades over the last 15 seconds. It is explicitly marked as held. Recovery starts a new valid segment only after the old marker has faded; the renderer does not accelerate it to catch up. New, unbracketed aircraft are not shown moving.

Gaps greater than 120 seconds or jumps exceeding 650 m/s plus 1 km of positional tolerance are not joined. Trails show only the latest continuous segment up to display time, never future observations. History is bounded to eight minutes, 64 points per aircraft and 1,500 aircraft. Normal-app query resets and relay changes clear history. Wall geometry, filter and mode changes retain histories and apply the new visible scope; changing the playback delay deliberately restarts the display clock within retained history.

### Camera and cards

Area and Fleet cameras remain fixed. The Follow camera uses only the delayed aircraft position, with a central dead zone and gradual recentering. It never follows the newer live response while displaying an older marker.

Aircraft selection uses proximity, available identity information and favourites, with repeat avoidance. Pinning suppresses rotation; if the pinned aircraft loses usable observations, its identity is retained while the display waits for data. The map count includes held positions and explicitly states how many are held.

## Settings and controls

| Setting | Behavior |
| --- | --- |
| Mode, centre and coverage | Area, Airline & aircraft, or Follow; map rectangle or circle; current app centre or a named saved view |
| Night/Sunset | Changes the presentation and cached tile styling |
| Near/Room/Far | Adjusts key typography and marker sizes; test at your actual viewing distance |
| Standard/Minimal | Minimal removes secondary metrics and reduces trails; only the featured aircraft is labelled in either setting |
| Aviation/Metric | ft, kt, NM or m, km/h, km; altitude is barometric, not terrain clearance |
| Motion | Smooth, reduced, or device preference; reduced mode uses discrete one-second position updates and no decorative transitions |
| Routes in aircraft-only labels | Orange code/full-location pages in the cycling card, on by default; can be turned off separately |
| Time zone | Valid IANA zone, for example Europe/Berlin or UTC; applies to clock and active hours |
| Active hours | Requests and wake lock stop outside the chosen window; overnight windows are supported |
| Keep awake | Requests a browser screen wake lock while visible and active; status appears in the controls |
| Auto-start | Opens wall mode next time in this browser; it cannot automatically authorize fullscreen |

Rest hours show a quiet resting screen. On resume the buffer is rebuilt from new observations. This schedule cannot turn a powered-off screen back on or launch a closed browser. Configure device power schedules separately. Dark colors are not a substitute for adjusting the screen's physical brightness or using panel-protection settings.

Fullscreen requires an initial user action in normal browsers. A browser or operating system may deny or release wake lock. The app releases it on exit, hidden-tab/rest states and page exit, and attempts to reacquire it when eligible. Kiosk startup and restart after a device reboot require device/browser configuration.

References: [Fullscreen request](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Privacy and sharing

Use **Copy display setup link** in the display settings. By default it contains only presentation settings, not location, filters, relay URL or credentials. To reproduce a search, explicitly enable **Include the location and search in a setup link**. That can reveal precise home coordinates. Saved-aircraft identifiers remain local: a saved-only filter on another screen uses that screen's own favourites.

A link sets up another screen; it does not control one already running. Phone pairing/remote control and scene playlists are not included in this release. Playback positions and trails stay in memory. The 24-hour log persists exact monitoring geometry, visits, flight segments, observed point timestamps/coordinates, available routes, coverage gaps and report snapshots in local IndexedDB. Export-folder handles stay on the same origin when supported. Setup links preserve the log layout but never include the recorded sightings or routes. Normal application preferences remain local to the browser. Route lookups send public callsigns and reported positions to ADSB.lol through the existing relay; they do not send the configured home location as a separate field.

## Network and map behavior

The existing single polling loop, request deadlines, provider fallbacks and cooldowns are preserved. Animating 30 frames per second does not request more flight data. Polling stops in hidden tabs and during rest hours. The renderer caps tile and track histories and does not bulk-download or prefetch offscreen map tiles. OpenStreetMap attribution remains visible whenever map tiles are displayed, and normal HTTP caching is used. The aircraft-only layout skips tiles and keeps flight-data attribution in its controls. See the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

Feed interruption, absence of matching aircraft and quiet skies are different states. An interrupted feed can still play buffered history until it runs out; it does not label that history live. Provider data availability is not guaranteed by the display code.

If the app redirects to `vercel.com/sso-api`, fix the public production-domain connection as described in SETUP.md. The wall-display update does not remove or bypass Vercel Deployment Protection.

## Verification

Run the shipped dependency-free checks with Node.js 24:

```sh
npm test
npm run build
```

The playback tests extract the exact engine embedded in `index.html`; they do not test a different source copy. They cover interpolation, wraparound, delay-clock consistency, out-of-order/duplicate reports, provider changes, missing values, startup, underrun, late recovery, gap/jump rejection, trails, retention and an accelerated synthetic 24-hour run. Movement-heading checks include cardinal directions, taxiway turns, inconsistent/missing reports, date-line crossings, the local Mercator tangent at high latitude, endpoint stability, position jitter and held orientation. Browser checks confirm both wall renderers use that angle, with consistent minimalist vectors, in Midnight and Sunset.

The aircraft-symbol tests also extract the actual embedded implementation. They check representative type codes, distinct categories, unknown-data fallbacks and that callsigns, registrations and military flags do not invent an aircraft design. The category drawings remain on the map and in the normal inspector. Wall-card checks cover journey figures, long route/model names, route changes and missing data without clipped content. Journey tests check great-circle geometry, date-line and antipodal cases, units, five-minute rounding and independence from taxi speed.

Sighting-log tests cover uniqueness across callsign changes, observation-based expiry, buffer clipping, invalid observations, reload persistence, separate areas, tab merging and retention. UI regression checks cover the reported EZY83LT search, local matches during provider cooldowns, ambiguous identities, manual ICAO follow, restoration of normal mode and log setup links. Browser checks exercise the actual scrolling loop, wraparound, pause/reduced motion, reloads and layout with fixture data.

Camera tests cover zoom/projection geometry, the collection limit, invalid settings, label values, arrow eligibility and label placement at screen edges. UI checks cover zoom persistence, setup links, separate Follow zoom, retained sightings and buffer tracks, and aircraft-only rendering. Browser checks at 1920×1080, 3840×2160, 1080×1920 and 320×740 verify the full-screen layout, settings usability and no tile requests during aircraft-only startup, then exercise switching back to map panels.

Route checks cover bounded batches, fixed upstream URLs, independent rate limits, delayed flight identity, callsign changes, reception gaps, ambiguous/missing routes, expiry, safe text, saved sightings and obsolete replies after reconnect. An unresolved or failed route request is tested alongside successful flight polling. Browser route checks use controlled responses at 1920×1080, 3840×2160, 1080×1920, 390×844 and 320×740 to verify the card, scrolling rows and optional aircraft-only labels.

Build 11 also tests the observed empty HTTP 201 response, individual GET routing, the two-request concurrency cap and cancellation of remaining work on provider errors. The original POST failure was reproduced against the deployed relay and the individual endpoint returned live route data. These network checks supplement the controlled regression tests.

Development verification also includes the existing UI/relay integration checks, new wall-settings/filter/schedule/wake-lock tests and browser layout checks from 320px to 4K, in landscape and portrait, using controlled fixture observations and map tiles. Synthetic tests are not a real 24-hour device test or a guarantee of live upstream availability. Before leaving the display unattended, verify its actual Vercel production URL, readability, fullscreen/wake behavior, power settings and an overnight run on the intended device.

## Build 25: shared information and Follow progress

Follow cards now place **Distance covered / Time airborne** in the band below the model and registration, above altitude and groundspeed. When departure was not observed, these become **Observed distance / Time observed**. The current relay supplies live observations; the app does not reconstruct an unseen departure from airport distance or cruise-speed estimates. See `FLIGHT-PROGRESS.md` for the evidence rules and storage bounds.

The web inspector and all wall presentations use `design-system/aircraft-info.js` for identities, units and rounding. **Appearance → Aircraft measurements / Time zone** and the corresponding Wall Settings fields change the same global preferences. Existing saved wall units and time zone migrate automatically. Geographic coverage units remain separate.

**Route estimates on cards** defaults to Area & Fleet. Choose All aircraft cards to add route distance and estimated total time below Follow's main metrics, or Off to hide estimates. Compact/short screens drop these secondary figures first. **Flight progress in aircraft-only Follow labels** adds two optional pages for the followed target; it is off by default. Standard altitude/speed/type/route cycling and vector clearance are preserved.

The journal still uses one row per physical aircraft with the latest saved route and First / Last / Sightings, without live metrics for departed aircraft. Area resets and daily exports remain separate from flight progress.

## Build 28: deeper glass

Wall cards and the 24-hour journal now use Regular glass with substantially more background transmission, stronger frost, an asymmetric specular rim and theme-coloured ambient spill. The floating wall control strip and map overlays use Clear glass. The aircraft-only artwork mode remains visually plain. Reduced effects removes transparency and blur. No flight, map, route or relay behavior changes in this build.
