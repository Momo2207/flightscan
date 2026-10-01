# Flightscan on Vercel

App build: **2026-10-01.vercel.21**. Relay build: **2026-09-30.vercel.11**.

This update adds actual mapped runway and taxiway paths to the Gallery map. Runways are clearer than taxiways; the airport boundary, apron and gates are omitted from this overlay. The compact labels and journey figures from build 20 are retained. Update the complete extracted project and redeploy; no credentials or environment-variable changes are needed.

## Updating your working installation

For this update, upload **all extracted files and folders** to your existing GitHub repository, preserving their paths, then redeploy Vercel. Build 19 implements all six wall-art improvements: a compact location/clock header, quiet vector cartography, a simpler travel card, a soft coordinated focus halo and recorded trail, a calmer 24-hour journal, and an optional daylight-following atmosphere. The implementation roadmap is included in `WALL-ART-PLAN.md`. Thin orange routes still alternate airport codes and full locations every eight seconds. Delayed playback, aircraft colours, visits and daily CSV/Excel exports remain included.

In **Wall Settings**, **Map style → Gallery** is the new default. **Street map** restores the previous cartography. **Atmosphere → Follow daylight** enables the sunset/night surface treatment; **Fixed appearance** keeps your chosen theme constant and is the default. These options are saved in this browser and included in setup links. No new account, API key, relay URL or environment variable is needed. Aircraft-only mode remains map-free.

Vercel's build assembles the bundled design sources into the HTML. Upload `design-system/` and `scripts/` as well as `index.html`; otherwise an older build script or older styles may overwrite this update. For a GitHub Pages-only frontend with no build step, the compiled `index.html` still works on its own, with embedded fonts. Your relay remains build 11. Keep existing environment variables and the public production relay URL.

| File | Purpose |
| --- | --- |
| `index.html` | Route displays and independent lookup scheduling, plus the existing wall modes and buffered playback |
| `api/relay.js` | Adds a bounded, validated route-batch endpoint alongside the existing flight and registration endpoints |

Upload the extracted files, not the ZIP itself, and preserve folder paths. If GitHub Pages and Vercel use separate repositories, update the frontend in the Pages repository and the relay in the Vercel repository. Keep your existing environment variables and credentials on Vercel.

If you set `CONFIG.apiBase` directly in your previous HTML, copy your **public Vercel production base URL** into the new `index.html` before uploading. A relay URL saved through Connection remains saved in the same browser and overrides that default. Opening the app on its public Vercel `.vercel.app` production address connects to that origin automatically.

With automatic Git deployments enabled, Vercel deploys the commit. Wait until it is ready, then refresh the app with Ctrl+Shift+R (Cmd+Shift+R on macOS). About → Connection diagnostics should show app build `2026-10-01.vercel.21`. Open your public Vercel domain followed by `/api/relay?path=health`: the relay should show build `2026-09-30.vercel.11`, `routeLookupMethod: "individual-get"`, `capabilities.routeLookup: true` and `capabilities.registrationLookup: true`. Different app and relay build numbers are expected for this frontend-only update. Existing retry delays remain in effect until they expire. An OpenSky authentication error is separate from route lookup; routes use ADSB.lol and require no OpenSky credentials.

## Flight spectrum colours

Choose **Wall display → Settings → Aircraft colours → Flight spectrum**, then apply the display settings. The preview shows blue ground, cyan climb, green level flight, yellow/orange/red descent and blue on ground again. Colours use the same delayed, interpolated telemetry as the moving aircraft, with an eight-second transition between states. The setting survives reloads and is included in display setup links. Midnight and Sunset themes have separate contrast-adjusted palettes. Aircraft labels and selection rings keep their existing styling; the normal interactive map keeps its discrete altitude categories, now with theme-specific contrast. No relay or environment changes are needed.

## Flight routes

Routes appear as airport codes, for example **FRA → LIS**, under the label **Route** or **Flight route**. The normal inspector also shows airport city/name details. Wall route displays alternate between codes and full locations every eight seconds, with a 500 ms crossfade. Reduced motion retains the automatic switch without the fade. City names are preferred, airport names are a fallback, and a missing location name retains its code. No name is guessed and no extra route requests are made. About explains that these are callsign-based inferences from ADSB.lol rather than confirmed flight plans. Missing, ambiguous, multi-leg or geographically implausible results stay hidden. No ETA, flight progress or destination arrival claim is added.

| View | Route display |
| --- | --- |
| Normal aircraft details | Below the selected callsign, with airport names and source |
| Desktop aircraft table | Optional **Show route column** checkbox; off initially |
| Wall featured card / Follow | Thin orange route alternates codes and full locations every eight seconds |
| 24-hour sightings | Same alternating orange presentation, using the route saved with the observed callsign |
| Aircraft-only wall layout | Thin orange route below altitude, alternates codes/full locations and wraps without clipping; **Show routes in aircraft-only labels** can be turned off |

Route lookups are on by default. **About → Look up likely routes** disables them; the optional table column is remembered separately. A route lookup sends the aircraft's public callsign and reported coordinates through the existing Vercel relay. See `DATA-SOURCES.md` for attribution and limitations. No additional credentials are needed for the currently public route endpoint.

Lookups run separately from position polling and delayed playback. The app submits up to four distinct callsigns per batch, at least 15 seconds apart. The relay makes individual GET requests with at most two in progress; the whole batch has a 20-second deadline and the browser allows 23 seconds. These limits include reading responses and account for more than one upstream request. A valid route is reused for ten minutes, an unknown result for five minutes. Route errors have their own retry delay and diagnostics, so a route failure does not cool down the aircraft-position provider. The relay still accepts older eight-plane requests, with the same concurrency and total deadline.

If some callsigns fail or time out, successful routes still appear. Failed callsigns wait before retrying; provider-wide access restrictions and quotas pause all route requests. A completely failed batch cannot keep unqueried aircraft at the back of the queue indefinitely. Live verification of build 11 retained a valid Gatwick → Thessaloniki route while three other callsigns returned HTTP 500 errors.

Routes are tied to ICAO ID, callsign and the observed flight episode. A callsign change or reception gap over 30 minutes starts a new episode. Delayed wall playback retains the identity of its own observation, and a late response cannot decorate a newer flight or replaced connection. Already saved sightings retain their observed route while in the 24-hour history; changing the sighting's flight clears that route. No historical routes are requested.

When entering wall mode, recorded playback points can recover the start of an existing route episode. This uses only the in-memory buffer, stops at unknown or different callsigns and respects already closed episodes. It performs no historical network lookup. The bounded route cache preserves valid route answers ahead of unresolved entries when a wider collection area supplies more aircraft.

## Wall display quick start

1. Select **Wall display** in the header, or **Settings** on an active display.
2. Choose **Area** or **Airline & aircraft**, keep **Fit map rectangle**, choose a centre and set **Coverage width** in km or NM. The height follows the actual map panel. Airline and aircraft selections can be combined here.
3. To follow an aircraft, choose **Follow aircraft**, enter a registration such as **D-ERRD**, a callsign currently received in the app such as **EZY83LT**, or its six-character ICAO ID, and select **Find aircraft**. Check the returned identity. Select the correct result if more than one is returned, then choose **Follow aircraft** at the bottom of the form. Callsigns are searched in current received observations; an offscreen aircraft can be found by registration or ICAO ID.
4. Keep **90 seconds** of playback delay initially. Set appearance, time zone, keep-awake and active hours as desired. These remain browser-local wall settings.
5. Allow observations to accumulate. A fresh start can take the chosen delay plus a feed interval; no synthetic planes are used during startup.
6. Move the pointer, tap or press a key to reveal controls. Choose **Exit display** or press Escape to restore the normal app's previous mode, area and camera.

For the scrolling log, choose **24-hour log · map & sightings** under **Display mode**. It shows one card per ICAO aircraft with its latest flight's route, type, airline, callsign, first/last observed times within the past 24 hours and sighting count. Entering this mode fixes an exact monitoring footprint. To change it, open **Recording & daily exports → Use current map area for recording**. Zooming or resizing changes the camera, not the monitoring footprint. Follow does not provide a full regional feed. See `SIGHTINGS-EXPORTS.md` for visit/session rules, migration and exports.

To receive daily files, open **Recording & daily exports**, choose **CSV** or **Excel workbook**, then enable **Automatically export every 24 hours**. The first period starts at that moment. Allow automatic downloads for the frontend's domain. A supported browser can instead use **Choose / reconnect export folder**. Completed reports remain in Settings for recovery; **Download current 24 hours** works immediately. Reports finalize within two minutes of the period boundary and process on resume if the browser was inactive. The app cannot collect flights while closed, hidden or resting.

**Zoom:** under **Area / 24-hour zoom**, choose **Automatic · fit coverage width** or a zoom from 4 to 15. Follow has its own **Follow zoom** setting. Higher numbers show a closer view. While displaying, use **+ / −**, **Fit area** or **Reset zoom** in the controls. Regional zoom adjusts the camera; the 24-hour recording area remains fixed, and its collection scope is maintained; very wide views are limited to the feed’s supported coverage. Zoom changes preserve the existing sightings log and interpolation buffer. Newly exposed areas need fresh observations.

**Aircraft only:** set **Wall layout → Aircraft only**, then apply. It works with Area, Airline & aircraft, Follow and the 24-hour log. It removes tiles, headers, panels, trails and the clock, leaving category icons with a callsign/altitude box and a short reported-direction arrow. Both Midnight and Sunset themes work. Controls hide after five seconds; touch, move the pointer or press a key to return them. Regional sightings keep recording in the background. Switch back to **Map & panels** to see the list or details again.

The list loops upward automatically in Smooth mode. Hover or keyboard focus pauses it temporarily; the controls include **Pause scrolling** and up/down paging. Reduced motion uses manual paging. Portrait screens put the list below the map.

See **WALL-DISPLAY.md** for playback behavior, rest hours, privacy, device setup, tests and limitations. The normal interface continues to show the most recent received positions; delayed interpolation is confined to Wall Display.

## If Vercel redirects to its login page

A `307` redirect to `vercel.com/sso-api` means Vercel Deployment Protection is intercepting the request before the relay. Adding CORS headers to the app cannot solve that platform login gate.

In your Vercel project's Domains/Production deployment, copy the **stable production domain**, not a per-deployment address containing a generated hash. In Flightscan → Connection, replace the saved relay URL and choose **Test & connect**. Check Project → Settings → Deployment Protection: **Standard Protection** keeps preview/generated deployment URLs protected while production domains are public. Do not put a Vercel protection-bypass secret in this public HTML.

In a private browser window, open your production domain followed by `/api/relay?path=health`. It should return relay JSON, not a login page. Health checks the relay configuration, not whether every provider currently supplies flights. See [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection).

## Using the three modes

**Area:** select a place and radius as before. Moving the map does not change the search. “Search this area” moves your chosen center to the map center and retains the radius. Airline and type filters are optional. Each mode remembers its own filters.

**Follow aircraft:** select an aircraft and choose “Follow this aircraft”, or enter its six-character ICAO hex in Follow mode. Following queries that identifier directly, so the target can leave the original radius. The callsign can change without changing the target. Panning or using the arrow keys pauses automatic centring; “Resume centring” returns to the newest reported position. “Return to Area” restores your area and filters. Pause remains available in every mode.

If an aircraft stops reporting, the map shows an amber, dashed **LAST KNOWN** marker with its observation age. The inspector retains the timestamp and metrics from that report, clearly labelled as old data. Current-result counts exclude missing/stale aircraft. The app never predicts movement, and it cannot guarantee continuous provider coverage. Non-ICAO identifiers prefixed with `~` cannot be followed as stable aircraft identifiers. Observed trails cover up to ten minutes of this open session.

**Explore fleet:** combine airline and aircraft type independently:

| Airline/operator | Aircraft type | Matches |
| --- | --- | --- |
| Lufthansa | Airbus A320 · A320 | Reported A320 type with a Lufthansa callsign prefix |
| All airlines | Airbus A320 · A320 | That reported type from any operator |
| Lufthansa | All aircraft types | Any type with a Lufthansa callsign prefix |
| All airlines | All aircraft types | All current aircraft in the search coverage |

“Exact type” matches the reported ICAO type code. “Type family” groups related codes. Airbus A320 family includes A318, A319, A320, A321, A319neo, A320neo and A321neo. The available family groups are listed in the selector. The app excludes aircraft without type metadata from specific type filters and displays how many were excluded. OpenSky does not include type or registration metadata, so a type-specific search may show no matches when it is the active fallback.

Airline names remain **inferred from callsigns**. Lufthansa means prefix `DLH`; separately coded subsidiaries remain separate operators. This is not a verified fleet ownership list.

Fleet coverage has two choices:

- **Current area:** your selected location and radius.
- **Map view:** pan/zoom, then click **Search this view**. The search uses those fixed geographic bounds until you explicitly search again. The boundary and scope label identify the searched region. Wide views are rejected before any request; zoom in until the corners fit within 450 km of the view center. Area providers return a covering circle, which the app clips to the searched rectangle. OpenSky uses a bounding box, split into two requests when crossing the date line. Repeated aircraft are deduplicated by identifier, retaining the newest report.

These are regional searches, not a worldwide inventory. Provider coverage and quotas still apply.

**Saved views:** expand Saved views, optionally give the view a name and press Save view. You can store up to 20 views including the mode, filters, area/searched bounds and camera. Reusing a name updates it. Load restores a view; Delete removes it. A followed identifier can also be saved. Last-known aircraft positions are not persisted across reloads. Mode settings, bookmarks and saved views stay in this browser. Share view includes the mode, area and airline/type selections, or the followed hex, in the URL.

## Requests and verification

Existing request deadlines, OAuth token handling and cooldowns remain in place. UI filtering adds no flight API calls. Searches and mode changes retain the normal request interval and existing provider retry delays; a countdown above the map shows when the next request will run. Polling pauses when this tab is hidden or Pause is active. A late response from an earlier mode is discarded.

New frontend requests use the existing canonical relay URL:

- `/api/relay?path=adsbfi/hex/abc123`
- `/api/relay?path=adsb/hex/abc123`
- `/api/relay?path=opensky/states&icao24=abc123`
- `/api/relay?path=adsbfi/reg/D-ERRD`
- `/api/relay?path=adsb/reg/D-ERRD`

The relay validates one six-character ICAO identifier and fetches only a fixed provider URL. It does not expose a general proxy or global snapshot route. An empty individual lookup tries the next eligible provider before showing a missing signal.

Reference names and logos remain bundled in the HTML. See `DATA-SOURCES.md` and `LICENSES/` for provenance.

The remaining sections describe a new installation.

## 1. Upload the files to GitHub

Extract `flightscan-vercel.zip` on your computer. Open your `momo2207/flightscan` repository, choose **Add file → Upload files**, and upload the extracted contents to the repository root. Preserve the folders listed below. Commit the changes.

Upload the extracted files, not the ZIP itself. Replace the existing `index.html`. If your repository also has an old `index.htm`, remove that obsolete duplicate so it cannot be opened by mistake.

| Repository path | Purpose |
| --- | --- |
| `index.html` | Updated app, usable on both GitHub Pages and Vercel |
| `api/relay.js` | Vercel Node.js relay, including OpenSky OAuth |
| `vercel.json` | Routes and 60-second function execution limit |
| `package.json` | Node.js 24 and build command; no npm dependencies |
| `scripts/build.mjs` | Copies only the HTML into the public output folder |
| `tests/relay.test.mjs` | Offline relay regression checks |
| `tests/wall-playback.test.mjs` | Offline interpolation, buffering, gap and bounded-history checks |
| `tests/wall-coverage.test.mjs` | Map-proportioned coverage and collection-margin checks |
| `tests/aircraft-symbols.test.mjs` | Type classification, conservative fallbacks and shared-symbol checks |
| `tests/sighting-log.test.mjs` | Rolling 24-hour expiry, deduplication, geographic separation and serialization checks |
| `tests/sighting-visits.test.mjs` | Multiple passages, flight segments, routes, precise areas, coverage gaps, CSV/XLSX and daily report rollover |
| `SIGHTINGS-EXPORTS.md` | Recording, migration, downloads, folder permissions and report schema |
| `tests/routes.test.mjs` | Flight-episode identity, delayed observations, route plausibility and expiry checks |
| `tests/routes-relay.test.mjs` | Fixed route endpoint, validated batches, independent quotas and deadline checks |
| `WALL-DISPLAY.md` | Wall-display setup and playback behavior |
| `SETUP.md` | These instructions |
| `DATA-SOURCES.md` | Sources and display rules for the bundled lookups and icons |
| `LICENSES/` | Reference-data and icon licenses and upstream credits |
| `.gitignore` | Excludes generated files and local credentials |

`vercel.json` and `package.json` must be at the selected Vercel project root. The old `worker.mjs` is not used by this deployment. Do not paste `api/relay.js` into the Cloudflare editor.

## 2. Import the repository into Vercel

In [Vercel](https://vercel.com/new), select **Add New → Project**, connect GitHub if necessary, and import `momo2207/flightscan`.

Use these settings:

| Setting | Value |
| --- | --- |
| Framework Preset | Other |
| Root Directory | Repository root (`.`) |
| Build Command | `npm run build` (supplied by `vercel.json`) |
| Output Directory | `public` (supplied by `vercel.json`) |
| Node.js | 24.x (supplied by `package.json`) |

Before deploying, add these **Environment Variables** for **Production**:

| Name | Value |
| --- | --- |
| `OPENSKY_CLIENT_ID` | Your existing OpenSky API client ID |
| `OPENSKY_CLIENT_SECRET` | Your existing OpenSky API client secret |

Use the same API client credentials you configured on Cloudflare. These are API credentials, not your OpenSky website password. Store their values only in Vercel's environment variable settings. Do not add them to GitHub, `index.html`, or `vercel.json`.

Click **Deploy**. If you add or change the variables after deploying, create a new deployment using **Deployments → Redeploy**. Existing deployments retain their previous environment values.

If both variables are absent, the relay uses anonymous OpenSky access with its associated limits. If only one is present, it reports a configuration error. The two ADS-B providers do not use these credentials.

## 3. Open your new app

Copy the project's **production domain**, for example `https://YOUR-PROJECT.vercel.app`, from Vercel. Replace `YOUR-PROJECT` in all examples with that actual domain.

Open that address. The app automatically connects to its own relay on a `*.vercel.app` domain. No HTML edit is needed for this option.

To check the deployment, open:

```text
https://YOUR-PROJECT.vercel.app/api/relay?path=health
```

Expected fields include:

```json
{
  "service": "flightscan-relay",
  "version": 1,
  "build": "2026-09-30.vercel.11",
  "platform": "vercel-node",
  "ok": true,
  "openskyAuthentication": "oauth",
  "upstreamChecked": false
}
```

The response also includes provider names and time limits. **Health verifies deployment and credential configuration; it does not test the credentials or prove that a provider is reachable.** The app's flight requests perform that test.

If the health link returns a Vercel sign-in page, check that you copied the production domain, not a protected preview deployment. For the public GitHub Pages frontend to use it, the production relay must be publicly accessible under the project's Deployment Protection settings.

## 4. Keep your existing GitHub Pages address, if desired

The updated `index.html` still works at [your GitHub Pages site](https://momo2207.github.io/flightscan/).

After GitHub Pages finishes deploying:

1. Reload the page, then open **Connection**.
2. Paste `https://YOUR-PROJECT.vercel.app`. Use only the HTTPS base address; do not add `/api/relay`, `/health`, or a trailing path.
3. Click **Test & connect**. The Vercel address is saved in this browser.

The app uses a new saved setting, so the previous Cloudflare URL is ignored. Provider retry delays from the old relay do not carry over to the new address.

To configure the Vercel address for every GitHub Pages visitor, edit this one line near the start of the script in `index.html` and commit it:

```js
apiBase: 'https://YOUR-PROJECT.vercel.app',
```

Leave the rest of `CONFIG` intact. A URL saved through Connection takes precedence; **Clear saved URL** restores the default from the file. For a custom frontend domain, set the public relay URL this way too. The relay already permits `https://momo2207.github.io`, its own origin, and Vercel's configured deployment/production origins. Additional HTTPS frontend origins can be added in the optional `ALLOWED_ORIGINS` Vercel environment variable, separated by commas, followed by a redeploy.

## Request deadlines and failure diagnostics

| Operation | Limit |
| --- | --- |
| OpenSky authentication | 30 seconds |
| Complete OpenSky relay request, including authentication and body reading | 45 seconds |
| Browser waiting for each OpenSky request | 50 seconds |
| Each ADS-B provider request on the relay | 9 seconds |
| Browser waiting for each ADS-B request | 12 seconds |
| Complete route-batch relay request | 20 seconds, at most two upstream lookups in progress |
| Browser waiting for a route batch | 23 seconds |
| Vercel function execution | 60 seconds |
| Entire browser polling round | 130 seconds, allowing both providers and two OpenSky boxes across the dateline |

These deadlines allow the relay to return a JSON error before the browser's own deadline during normal execution. Navigation, pausing, hiding the tab or changing area still deliberately cancels requests. A connection failure can also return before the stated maximum.

Open **About → Connection diagnostics** to verify the app build and relay URL. If it still shows the old build, refresh GitHub Pages after deployment with Ctrl+F5.

| Error | Meaning / next step |
| --- | --- |
| `OPENSKY_AUTH_CONFIG` | Set both OpenSky variables in the Production environment, then redeploy. |
| `OPENSKY_AUTH_REJECTED` | OpenSky returned an authentication error; check API client credentials and access. |
| `OPENSKY_AUTH_TIMEOUT` | The authentication operation did not complete within its deadline. It is not a frontend CORS error. |
| `OPENSKY_AUTH_NETWORK` with `UND_ERR_CONNECT_TIMEOUT` | Node could not establish the authentication connection within its transport timeout. |
| `UPSTREAM_TIMEOUT` | Authentication completed or was unnecessary, but the flight-data request did not finish. |
| HTTP 403 or 429 from a provider | Provider access restriction or quota. The relay and app respect the retry delay. |
| `UPSTREAM_EMPTY` in Flight routes | The route endpoint returned no body. Build 11 includes the upstream HTTP status in the message. |
| `UPSTREAM_NON_JSON` in Flight routes | The route endpoint returned unusable content. Ensure the relay is build 11 and health says `individual-get`. |

The JSON response identifies `provider`, `stage`, `code`, `retryAfter` and, when available, a safe `networkCode`. It never returns the authentication response body or access token. `/health` remains available during a provider cooldown.

**Moving to Vercel does not guarantee that OpenSky or another provider will accept its outbound IP addresses.** If authentication still times out on Vercel, contact OpenSky about supported hosting/access for your account. Increasing browser timeouts does not remove a provider restriction. This package was verified locally with controlled upstream responses; it has not been deployed or tested against live providers from your Vercel account.

## Implementation and local checks

The relay caches valid ADS-B data for 25 seconds and OpenSky data for 55 seconds. It preserves original observation times, shares concurrent requests, reuses unexpired OAuth tokens, and refreshes a rejected token once after an OpenSky HTTP 401. It does not retry immediately after a 403, 429 or timeout, follow upstream redirects, fabricate aircraft, or serve stale cached results as fresh data.

Tokens, data and cooldowns are held in bounded memory in each warm function instance. Cache and quota state are not shared globally across instances and may disappear when Vercel starts a new instance. Browser retry delays survive reloads. This is intended for the existing personal app; larger traffic requires shared quota coordination and provider capacity.

With Node.js 24 installed, run these commands from the project root:

```sh
npm test
npm run build
```

The relay tests make no live provider requests and need no secrets. The build generates `public/index.html`; do not edit that generated copy. Edit the root `index.html` instead.

## Vercel documentation

- [Node.js functions in the api folder](https://vercel.com/docs/functions/runtimes/node-js)
- [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Environment variables and redeployment](https://vercel.com/docs/environment-variables/managing-environment-variables)
- [Function duration configuration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Rewrites](https://vercel.com/docs/routing/rewrites)
