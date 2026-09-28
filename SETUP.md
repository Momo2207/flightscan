# Flightscan on Vercel

Build: **2026-09-28.vercel.1**

This project runs the flight relay as a Vercel Node.js function. It includes the updated standalone HTML app. You can use the Vercel website directly or keep your existing GitHub Pages address.

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
| `SETUP.md` | These instructions |
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
  "build": "2026-09-28.vercel.1",
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
