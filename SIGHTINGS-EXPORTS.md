# Sightings and daily exports

App build `2026-10-05.vercel.29`. This update changes the frontend only; relay build 11 remains compatible.

## Start recording

Choose **Wall display → 24-hour log · map & sightings**. By default, the observation rectangle matches the actual map canvas and updates when you zoom, resize the display or change layout. Open **Settings → Recording & daily exports** to inspect the area. Turn off **Match the visible map in 24-hour mode** to keep it fixed; **Use current map area for recording** then changes it explicitly.

Each footprint has its own history. Earlier records and reports are preserved. New footprints reuse actual saved positions within their bounds, with original observation times, identities and saved routes. They do not copy position-free imported aggregates, claim continuous historical coverage or request old flights. **Recorded areas** selects which history the wall list, reset and immediate download use; recording continues in the current observation area.

The wall log uses the regional feed around the monitoring area. In other modes, full-area recording requires the actual feed request to cover that area. Follow mode cannot collect a complete regional history. Filters change the presentation; they do not filter the aircraft recorded from a covering feed.

## Reset an area

In **Settings → Recording & daily exports**, select **Current observation area** or an earlier area under **Recorded areas**, then choose **Reset sightings for this area**. Only that area's observations, visits, flight segments, coverage gaps and imported rows are cleared. Its geometry and sighting-gap setting remain. Other areas and already completed reports stay available.

An enabled daily export period for the reset area starts again at the reset time. New position observations after that time begin new visits; cached earlier positions and stale tab snapshots cannot restore cleared records. The reset is persisted in IndexedDB and synchronized to read-only tabs. Only the tab currently recording can reset an area. A storage failure is reported in Settings and retains the reset in memory for retry. If persistent storage is unavailable, the reset applies to this session.

## Read the wall list

Each physical aircraft has one card, identified internally by its ICAO hex. The card shows its latest recorded callsign, registration, type, airline and available route, followed by:

**First 08:42 · Last 14:06 · 3 sightings**

First and last are actual observed positions inside the monitoring area within the rolling past 24 hours. A date prefix distinguishes yesterday's observations. Times use the wall's selected time zone. Map interpolation and playback delay never change the recorded timestamps.

Two fresh positions outside the boundary margin confirm an exit. Returning then starts another sighting. Near-edge position noise does not create another passage. Missing reception closes an observation session after the configured **New sighting after a gap** interval, initially five minutes. Its later return also starts a session, without claiming a confirmed physical exit. The export distinguishes these cases.

A callsign change starts another flight segment within the same sighting, so it does not inflate the geographic sighting count. The unique-aircraft card uses the latest segment's route. If that segment has no route, the card leaves the route out; older flight routes remain in the report.

## Route retention

Fresh aircraft inside the monitoring area enter the existing route queue before they appear in delayed playback. A successful route is saved against its matching flight segment. It survives the live route cache's expiry, a failed later lookup, departure from the map and page reload.

An in-flight lookup that finishes after departure can enrich its own recorded segment when the identity and position evidence match. The application does not request routes for aircraft that departed hours earlier. Unknown routes remain empty. Source and route limitations remain in About and `DATA-SOURCES.md`.

## Enable daily files

1. Open **Settings → Recording & daily exports**.
2. Choose **CSV** or **Excel workbook**. CSV defaults to a semicolon separator; comma is also available.
3. Enable **Automatically export every 24 hours**. The first reporting period starts then, rather than at midnight.
4. Allow automatic downloads for the frontend's domain. On a browser that offers the feature, **Choose / reconnect export folder** can save directly to an authorized folder instead.

Periods are exactly 24 elapsed hours, including daylight-saving changes. They use consecutive non-overlapping bounds and finalize after a two-minute grace period. The rolling wall list remains independent of this reporting cycle.

The browser must keep the application running to collect observations. Closed, hidden, sleeping, paused or scheduled-rest periods can leave coverage gaps. On resume, overdue reports are created from the observations already stored; missing flights are not reconstructed. Several overdue deliveries are spaced out rather than requested together.

**Download current 24 hours** creates an immediate report for the selected recorded area. The history below the controls lets you recover previously completed daily reports. Downloading a report again does not restart its recording period.

## File contents

| Format | Contents |
| --- | --- |
| CSV | Visit/flight-segment rows, a recording-period row and coverage-gap rows. Use the `record` column to distinguish them. |
| XLSX | `Aircraft` summary, `Visits` with all flight segments and `Recording` with period, geometry and gaps. |

Both formats include aircraft identity, type, airline, callsign, available route, first/last in-window observation, original visit times, stable visit/segment IDs, sighting count, confirmed reentry, boundary reasons, observation count and report bounds. Route-check time is retained. Carry-in and carry-out fields describe visits spanning a reporting boundary; the same visit keeps its ID across reports.

UTC timestamps and explicitly zoned local-time columns are supplied. Unknown values are empty. CSV uses UTF-8 with a BOM, CRLF and quoted fields. Formula-leading text and numeric-looking identifiers receive a protective text prefix for Excel. For exact identifiers without that CSV prefix, use XLSX, which stores them as string cells. The workbook is a real Excel file with three sheets, frozen headers and filters.

## Recovery and storage

Visits, observed positions, routes, geometry and completed reports are stored locally in IndexedDB on the frontend's origin. Another browser, device or domain has separate records. Clearing site data deletes this history. Older local sightings are imported with their known times and route, but missing passage counts and precise historical geometry are not invented. The original legacy backup remains untouched.

Only one tab records and automatically exports at a time. Other tabs can read history and request manual downloads. The app keeps seven requested/saved daily reports per area and retains pending or failed folder deliveries separately.

**Download requested** means that the browser received a download request; it does not confirm that a file reached disk. Check your browser's automatic-download permission. Folder delivery is marked **Saved** only after the file stream closes successfully. Expired permission leaves a recoverable report and prompts you to reconnect through Settings. Directory selection depends on browser support; ordinary CSV/XLSX downloads remain available.

A storage failure appears in Settings and preserves unsaved records in memory for retry. If persistent storage is unavailable, recording continues for the current session and manual downloads remain possible, while automatic reports are disabled. These local files contain aircraft observations and your monitoring-area bounds; handle them accordingly.

## Verification

The package's tests exercise repeat entries, boundary noise, stale/duplicate reports, observation gaps, callsign segments, retained and late routes, exact window boundaries, migration, report rollover, DST, CSV protection and XLSX structure. Browser checks exercise real IndexedDB, tab ownership, native downloads, reload recovery, transaction rollback, storage failures and folder-permission recovery using controlled feeds. The 24-hour rollover is accelerated; this release has not completed a live 24-hour soak on your display.
