/* Flightscan: Vercel Node.js function, not a Cloudflare Worker or Edge function.
 * API client credentials belong in Vercel environment variables, never in HTML.
 * Only the three fixed providers below can be requested. No dependencies.
 */
import { createHash } from 'node:crypto';

export const BUILD = '2026-09-30.vercel.10';
const USER_AGENT = 'Flightscan/2.0 (+https://momo2207.github.io/flightscan/)';
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
export const LIMITS = Object.freeze({ auth: 30000, opensky: 45000, adsb: 9000, routes: 6500 });

function routeAirport(value) {
  if (!value || !/^[A-Z0-9]{4}$/.test(value.icao || '') || !Number.isFinite(value.lat) || !Number.isFinite(value.lon) ||
      Math.abs(value.lat) > 90 || Math.abs(value.lon) > 180) return null;
  const clean = (text, length) => typeof text === 'string' ? text.trim().replace(/[\x00-\x1f]/g, '').slice(0, length) : '';
  const iata = /^[A-Z]{3}$/.test(value.iata || '') ? value.iata : '';
  return { code: iata || value.icao, icao: value.icao, iata, name: clean(value.name, 100), city: clean(value.location, 80), lat: value.lat, lon: value.lon };
}

function routeRows(body) {
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return null; } }
  const rows = Array.isArray(body) ? body : Array.isArray(body?.routes) ? body.routes : null;
  return rows && rows.length <= 64 ? rows : null;
}

function cleanRoutes(body, planes, timestamp) {
  const rows = routeRows(body);
  return { service: 'flightscan-routes', source: 'ADSB.lol', confidence: 'likely', checkedAt: timestamp,
    routes: planes.map(plane => {
      const matches = rows.filter(row => row?.callsign === plane.callsign);
      // A plausible result is still a callsign inference, not a confirmed flight plan.
      // Duplicate, multi-leg and unvalidated answers cannot select a unique route.
      const row = matches.length === 1 ? matches[0] : null;
      const airports = row?.plausible === true && Array.isArray(row._airports) && row._airports.length === 2
        ? row._airports.map(routeAirport) : [];
      const route = airports.length === 2 && airports.every(Boolean) && airports[0].icao !== airports[1].icao
        ? { callsign: plane.callsign, from: airports[0], to: airports[1], source: 'ADSB.lol', confidence: 'likely', checkedAt: timestamp, observationTime: plane.time } : null;
      return { hex: plane.hex, callsign: plane.callsign, time: plane.time, route };
    }) };
}

function credentials(env) {
  const clientId = String(env.OPENSKY_CLIENT_ID || '').trim();
  const clientSecret = String(env.OPENSKY_CLIENT_SECRET || '').trim();
  return { clientId, clientSecret, mode: clientId && clientSecret ? 'oauth' : clientId || clientSecret ? 'incomplete' : 'anonymous' };
}

function failure(message, code, { status = 502, retry = 120, stage = 'flight-data', networkCode } = {}) {
  return Object.assign(new Error(message), { relayFailure: true, code, status, retry, stage, networkCode });
}

function networkCode(error) {
  const code = error?.cause?.code || error?.code;
  // Do not expose raw exception messages, response bodies, tokens or credentials.
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(code) ? code : undefined;
}

function retrySeconds(value, now) {
  if (!value) return 0;
  const number = Number(value);
  if (Number.isFinite(number)) return Math.max(0, Math.ceil(number));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - now()) / 1000)) : 0;
}

// Abort the socket AND bound the promise, including reading/parsing the body.
// A transport that ignores abort must not keep the browser waiting indefinitely.
async function deadline(operation, ms, timeoutError) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      const error = timeoutError();
      reject(error);
      controller.abort(error);
    }, ms);
  });
  try { return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]); }
  finally { clearTimeout(timer); }
}

function coordinate(value, min, max) {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function endpoint(requestUrl, limits, timestamp) {
  const url = new URL(requestUrl);
  // The app uses this canonical URL. vercel.json supplies readable aliases too.
  const paths = url.searchParams.getAll('path');
  if (paths.length > 1) return null;
  if (paths.length) {
    if (!paths[0] || paths[0].startsWith('/') || paths[0].includes('?')) return null;
    url.pathname = '/' + paths[0];
    url.searchParams.delete('path');
  } else if (url.pathname === '/api/relay') {
    return null;
  }
  if (url.pathname === '/health' && !url.search) return { health: true };
  if (url.pathname === '/routes') {
    if ([...url.searchParams.keys()].length !== 1 || url.searchParams.getAll('planes').length !== 1 || url.search.length > 6000) return null;
    let planes;
    try { planes = JSON.parse(url.searchParams.get('planes')); } catch { return null; }
    if (!Array.isArray(planes) || !planes.length || planes.length > 8) return null;
    const seen = new Set();
    for (const plane of planes) {
      if (!plane || Object.keys(plane).sort().join(',') !== 'callsign,hex,lat,lon,time' ||
          !/^[a-f0-9]{6}$/.test(plane.hex || '') || !/^[A-Z0-9]{2,8}$/.test(plane.callsign || '') ||
          !Number.isFinite(plane.lat) || Math.abs(plane.lat) > 90 || !Number.isFinite(plane.lon) || Math.abs(plane.lon) > 180 ||
          !Number.isSafeInteger(plane.time) || plane.time > timestamp + 5000 || plane.time < timestamp - 240000 || seen.has(plane.callsign)) return null;
      seen.add(plane.callsign);
    }
    return { provider: 'ADSB.lol routes', url: 'https://api.adsb.lol/api/0/routeset', method: 'POST',
      body: JSON.stringify({ planes: planes.map(p => ({ callsign: p.callsign, lat: p.lat, lng: p.lon })) }),
      identity: JSON.stringify(planes), ttl: 60000, timeout: limits.routes ?? 6500,
      valid: data => routeRows(data) !== null, transform: data => cleanRoutes(data, planes, timestamp) };
  }
  const registration = url.pathname.match(/^\/(adsb|adsbfi)\/reg\/([A-Za-z0-9][A-Za-z0-9-]{1,11})\/?$/);
  if (registration && !url.search && !registration[2].endsWith('-') && !registration[2].includes('--')) {
    const reg = registration[2].toUpperCase();
    return {
      provider: registration[1] === 'adsbfi' ? 'adsb.fi' : 'ADSB.lol',
      url: registration[1] === 'adsbfi'
        ? `https://opendata.adsb.fi/api/v2/registration/${reg}`
        : `https://api.adsb.lol/v2/reg/${reg}`,
      ttl: 60000, timeout: limits.adsb,
      valid: data => data && Array.isArray(data.ac ?? data.aircraft),
    };
  }
  // Follow one stable ICAO identifier. Never accept arbitrary provider URLs,
  // wildcards, lists of identifiers or unrestricted global snapshot queries.
  const aircraft = url.pathname.match(/^\/(adsb|adsbfi)\/hex\/([a-fA-F0-9]{6})\/?$/);
  if (aircraft && !url.search) {
    const hex = aircraft[2].toLowerCase();
    return {
      provider: aircraft[1] === 'adsbfi' ? 'adsb.fi' : 'ADSB.lol',
      url: aircraft[1] === 'adsbfi'
        ? `https://opendata.adsb.fi/api/v2/hex/${hex}`
        : `https://api.adsb.lol/v2/hex/${hex}`,
      ttl: 25000, timeout: limits.adsb,
      valid: data => data && Array.isArray(data.ac ?? data.aircraft),
    };
  }
  const point = url.pathname.match(/^\/(adsb|adsbfi)\/point\/([^/]+)\/([^/]+)\/([^/]+)\/?$/);
  if (point && !url.search) {
    const lat = coordinate(point[2], -85, 85), lon = coordinate(point[3], -180, 180), nm = coordinate(point[4], 1, 243);
    if (lat === null || lon === null || nm === null) return null;
    return {
      provider: point[1] === 'adsbfi' ? 'adsb.fi' : 'ADSB.lol',
      url: point[1] === 'adsbfi'
        ? `https://opendata.adsb.fi/api/v3/lat/${lat.toFixed(5)}/lon/${lon.toFixed(5)}/dist/${Math.ceil(nm)}`
        : `https://api.adsb.lol/v2/point/${lat.toFixed(5)}/${lon.toFixed(5)}/${Math.ceil(nm)}`,
      ttl: 25000, timeout: limits.adsb,
      valid: data => data && Array.isArray(data.ac ?? data.aircraft),
    };
  }
  if (url.pathname === '/opensky/states') {
    if (url.searchParams.has('icao24')) {
      const identifiers = url.searchParams.getAll('icao24');
      if ([...url.searchParams.keys()].length !== 1 || identifiers.length !== 1 || !/^[a-fA-F0-9]{6}$/.test(identifiers[0])) return null;
      return {
        provider: 'OpenSky',
        url: 'https://opensky-network.org/api/states/all?icao24=' + identifiers[0].toLowerCase(),
        ttl: 55000, timeout: limits.opensky,
        valid: data => data && Number.isFinite(data.time) && (data.states === null || Array.isArray(data.states)),
      };
    }
    const names = ['lamin', 'lamax', 'lomin', 'lomax'];
    if ([...url.searchParams.keys()].length !== 4 || names.some(name => url.searchParams.getAll(name).length !== 1)) return null;
    const values = names.map((name, i) => coordinate(url.searchParams.get(name), i < 2 ? -90 : -180, i < 2 ? 90 : 180));
    if (values.some(value => value === null)) return null;
    const [south, north, west, east] = values;
    if (south >= north || west >= east || north - south > 8.2) return null;
    return {
      provider: 'OpenSky',
      url: 'https://opensky-network.org/api/states/all?' + new URLSearchParams(names.map((name, i) => [name, values[i].toFixed(5)])),
      ttl: 55000, timeout: limits.opensky,
      valid: data => data && Number.isFinite(data.time) && (data.states === null || Array.isArray(data.states)),
    };
  }
  return null;
}

function originsFor(request, env) {
  const allowed = new Set(['https://momo2207.github.io', new URL(request.url).origin]);
  for (const host of [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (host) {
      try { allowed.add(new URL('https://' + host).origin); } catch { /* Ignore invalid configuration. */ }
    }
  }
  for (const item of String(env.ALLOWED_ORIGINS || '').split(',')) {
    try {
      const url = new URL(item.trim());
      if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) allowed.add(url.origin);
    } catch { /* An empty optional setting adds no origins. */ }
  }
  return allowed;
}

/** A warm function instance shares tokens, cached data, in-flight work and cooldowns.
 * These are bounded, best-effort memory caches, not a global quota database.
 * Injection points below support deterministic offline tests; never read from a URL.
 */
export function createRelay({ fetchUpstream = (...args) => fetch(...args), now = Date.now, limits = LIMITS } = {}) {
  const cache = new Map(), cooldowns = new Map(), pending = new Map(), lastRequest = new Map();
  let cacheBytes = 0, tokenState = null, tokenPending = null;

  function forget(key) {
    const value = cache.get(key);
    if (value) { cacheBytes -= value.bytes; cache.delete(key); }
  }
  function remember(key, text, ttl) {
    for (const [id, item] of cache) if (item.until <= now()) forget(id);
    forget(key);
    const bytes = Buffer.byteLength(text);
    if (bytes > 8 * 1024 * 1024) return;
    while (cache.size && (cache.size >= 128 || cacheBytes + bytes > 8 * 1024 * 1024)) forget(cache.keys().next().value);
    cache.set(key, { text, bytes, until: now() + ttl });
    cacheBytes += bytes;
  }

  async function token(config, rejectedToken = '') {
    const key = config.clientId + '\0' + config.clientSecret;
    if (tokenState?.key === key && tokenState.value === rejectedToken) tokenState = null;
    if (tokenState?.key === key && tokenState.until > now()) return tokenState.value;
    if (tokenPending?.key === key) return tokenPending.promise;
    const promise = deadline(async signal => {
      try {
        const response = await fetchUpstream(TOKEN_URL, {
          method: 'POST', redirect: 'manual', signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': USER_AGENT },
          body: new URLSearchParams({ grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret }).toString(),
        });
        signal.throwIfAborted();
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          const retry = retrySeconds(response.headers.get('Retry-After'), now);
          throw failure(`OpenSky authentication returned HTTP ${response.status}. Check the API client credentials and access.`,
            response.status >= 300 && response.status < 400 ? 'OPENSKY_AUTH_REDIRECT' : 'OPENSKY_AUTH_REJECTED',
            { stage: 'authentication', status: response.status === 429 ? 429 : 502, retry: retry || (response.status === 429 ? 900 : 60) });
        }
        let data;
        try { data = await response.json(); }
        catch (error) {
          signal.throwIfAborted();
          throw failure('OpenSky authentication returned invalid JSON.', 'OPENSKY_AUTH_INVALID_DATA', { stage: 'authentication' });
        }
        signal.throwIfAborted();
        const lifetime = Number(data?.expires_in ?? 1800);
        if (typeof data?.access_token !== 'string' || !data.access_token || /[\r\n]/.test(data.access_token) ||
            !Number.isFinite(lifetime) || lifetime <= 0 || (data.token_type && String(data.token_type).toLowerCase() !== 'bearer')) {
          throw failure('OpenSky authentication returned an invalid token response.', 'OPENSKY_AUTH_INVALID_DATA', { stage: 'authentication' });
        }
        const seconds = Math.min(lifetime, 1800);
        tokenState = { key, value: data.access_token, until: now() + (seconds - Math.min(30, seconds / 2)) * 1000 };
        return tokenState.value;
      } catch (error) {
        if (error.relayFailure) throw error;
        throw failure('OpenSky authentication could not be reached.', 'OPENSKY_AUTH_NETWORK', { stage: 'authentication', networkCode: networkCode(error) });
      }
    }, limits.auth, () => failure('OpenSky authentication exceeded the request time limit.', 'OPENSKY_AUTH_TIMEOUT', { stage: 'authentication', status: 504 }));
    tokenPending = { key, promise };
    try { return await promise; }
    finally { if (tokenPending?.promise === promise) tokenPending = null; }
  }

  async function load(target, auth, providerKey, cacheKey) {
    const started = now();
    let stage = target.method === 'POST' ? 'routes' : 'flight-data';
    try {
      const data = await deadline(async signal => {
        let bearer = '';
        if (target.provider === 'OpenSky' && auth.mode === 'oauth') {
          stage = 'authentication';
          bearer = await token(auth);
          signal.throwIfAborted();
          stage = 'flight-data';
        }
        const get = () => fetchUpstream(target.url, {
          method: target.method || 'GET', redirect: 'manual', signal,
          headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...(target.body ? { 'Content-Type': 'application/json' } : {}), ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}) },
          ...(target.body ? { body: target.body } : {}),
        });
        let response = await get();
        signal.throwIfAborted();
        // Refresh once after an expired bearer token. Never loop on 403/429.
        if (response.status === 401 && bearer) {
          void response.body?.cancel().catch(() => {});
          stage = 'authentication';
          bearer = await token(auth, bearer);
          signal.throwIfAborted();
          stage = 'flight-data';
          response = await get();
          signal.throwIfAborted();
        }
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          if (response.status >= 300 && response.status < 400) {
            throw failure(`${target.provider} returned an unexpected redirect (HTTP ${response.status}).`, 'UPSTREAM_REDIRECT', { stage });
          }
          const retry = retrySeconds(response.headers.get('Retry-After') || response.headers.get('X-Rate-Limit-Retry-After-Seconds'), now);
          const fallback = response.status === 429 ? (target.provider === 'OpenSky' ? 3600 : 900)
            : [400, 401, 403, 404].includes(response.status) ? 3600 : 120;
          throw failure(`${target.provider} returned HTTP ${response.status}.`, 'UPSTREAM_HTTP', { status: response.status, retry: retry || fallback, stage });
        }
        let body;
        try { body = await response.json(); }
        catch {
          signal.throwIfAborted();
          throw failure(`${target.provider} returned a non-JSON response.`, 'UPSTREAM_NON_JSON', { stage });
        }
        signal.throwIfAborted();
        if (!target.valid(body)) throw failure(`${target.provider} returned an unexpected response.`, 'UPSTREAM_INVALID_DATA', { stage });
        return target.transform ? target.transform(body) : body;
      }, target.timeout, () => failure(stage === 'authentication' ? 'OpenSky authentication exceeded the request time limit.' : `${target.provider} exceeded the request time limit.`,
        stage === 'authentication' ? 'OPENSKY_AUTH_TIMEOUT' : 'UPSTREAM_TIMEOUT', { status: 504, stage }));
      // Keep upstream observation times intact. Never relabel old positions as live.
      const text = JSON.stringify(data);
      remember(cacheKey, text, target.ttl);
      return { text, status: 200, headers: { 'X-Flightscan-Cache': 'MISS' } };
    } catch (error) {
      const problem = error.relayFailure ? error : failure(`${target.provider} could not be reached.`, 'UPSTREAM_FETCH_FAILED', { stage, networkCode: networkCode(error) });
      const body = { error: problem.message, code: problem.code, provider: target.provider, stage: problem.stage,
        elapsedMs: Math.max(0, now() - started), retryAfter: problem.retry, ...(problem.networkCode ? { networkCode: problem.networkCode } : {}) };
      cooldowns.set(providerKey, { until: now() + problem.retry * 1000, body, status: problem.status });
      return { text: JSON.stringify(body), status: problem.status, headers: { 'Retry-After': String(problem.retry) } };
    }
  }

  return async function relay(request, env = {}) {
    const origin = request.headers.get('Origin') || '';
    const allowed = originsFor(request, env);
    function respond(text, status = 200, extra = {}) {
      const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'X-Flightscan-Build': BUILD, Vary: 'Origin', ...extra,
      });
      if (allowed.has(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        headers.set('Access-Control-Expose-Headers', 'Retry-After, X-Flightscan-Build, X-Flightscan-Cache');
        headers.set('Access-Control-Max-Age', '86400');
      }
      return new Response(status === 204 ? null : text, { status, headers });
    }
    const json = (body, status = 200, extra = {}) => respond(JSON.stringify(body), status, extra);
    if (origin && !allowed.has(origin)) return json({ error: 'This website origin is not allowed by the relay.', code: 'ORIGIN_DENIED' }, 403);
    if (request.method === 'OPTIONS') {
      const method = request.headers.get('Access-Control-Request-Method');
      if ((method && method !== 'GET') || request.headers.get('Access-Control-Request-Headers')) return json({ error: 'Only simple GET requests are supported.' }, 400);
      return respond(null, 204);
    }
    if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405, { Allow: 'GET, OPTIONS' });
    const target = endpoint(request.url, limits, now());
    if (!target) return json({ error: 'Invalid flight endpoint or coordinates.', code: 'INVALID_ENDPOINT' }, 400);
    const auth = credentials(env);
    if (target.health) return json({
      service: 'flightscan-relay', version: 1, build: BUILD, platform: 'vercel-node', ok: true,
      providers: ['adsb.fi', 'ADSB.lol', 'OpenSky'], openskyAuthentication: auth.mode,
      upstreamChecked: false, timeoutsMs: limits, capabilities: { aircraftLookup: true, registrationLookup: true, boundedMapSearch: true, routeLookup: true },
    });
    if (target.provider === 'OpenSky' && auth.mode === 'incomplete') return json({
      error: 'Set both OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET in Vercel environment variables, then redeploy.',
      code: 'OPENSKY_AUTH_CONFIG', provider: 'OpenSky', stage: 'authentication', retryAfter: 60,
    }, 503, { 'Retry-After': '60' });
    const providerKey = target.provider === 'OpenSky' && auth.mode === 'oauth'
      ? 'OpenSky:oauth:' + createHash('sha256').update(auth.clientId).digest('hex') : target.provider;
    const cacheKey = providerKey + ':' + target.url + (target.identity || '');
    const hit = cache.get(cacheKey);
    if (hit?.until > now()) return respond(hit.text, 200, { 'X-Flightscan-Cache': 'HIT' });
    if (hit) forget(cacheKey);
    const cooldown = cooldowns.get(providerKey);
    if (cooldown?.until > now()) {
      const retry = Math.ceil((cooldown.until - now()) / 1000);
      return json({ ...cooldown.body, cooldown: true, retryAfter: retry }, cooldown.status, { 'Retry-After': String(retry) });
    }
    if (cooldown) cooldowns.delete(providerKey);
    if (pending.has(cacheKey)) {
      const result = await pending.get(cacheKey);
      return respond(result.text, result.status, result.headers);
    }
    if (pending.size >= 64) return json({ error: 'Relay busy; try again shortly.', code: 'RELAY_BUSY', retryAfter: 2 }, 503, { 'Retry-After': '2' });
    // A dateline crossing uses two adjacent OpenSky boxes. Others are paced.
    const pacing = target.provider === 'ADSB.lol routes' ? 15000 : 1100;
    if (target.provider !== 'OpenSky' && lastRequest.has(providerKey) && now() - lastRequest.get(providerKey) < pacing) {
      const retry = target.provider === 'ADSB.lol routes' ? Math.ceil((pacing - now() + lastRequest.get(providerKey)) / 1000) : 2;
      return json({ error: `${target.provider}: wait before requesting more data.`, code: 'RELAY_PACING', provider: target.provider, retryAfter: retry }, 429, { 'Retry-After': String(retry) });
    }
    lastRequest.set(providerKey, now());
    const promise = load(target, auth, providerKey, cacheKey);
    pending.set(cacheKey, promise);
    try {
      const result = await promise;
      return respond(result.text, result.status, result.headers);
    } finally { if (pending.get(cacheKey) === promise) pending.delete(cacheKey); }
  };
}

const relay = createRelay();
export default {
  fetch(request) { return relay(request, process.env); },
};
