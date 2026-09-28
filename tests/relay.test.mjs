import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { BUILD, createRelay, LIMITS } from '../api/relay.js';

const ORIGIN = 'https://momo2207.github.io';
const BASE = 'https://my-flightscan.vercel.app';
const TOKEN = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const POINT = '/adsbfi/point/48.47377/7.94495/54';
const BOX = '/opensky/states?lamin=47.57445&lamax=49.37309&lomin=6.58836&lomax=9.30154';
const ENV = { OPENSKY_CLIENT_ID: 'client+&id', OPENSKY_CLIENT_SECRET: 'secret&+/=value' };
const snapshot = () => ({ time: 1700000000, states: null });
const planes = () => ({ now: 1700000000000, ac: [{ hex: 'abc123', seen_pos: 3, lat: 48.48, lon: 7.95 }] });
const tokenResponse = (value = 'private-token', expires = 1800) => Response.json({ access_token: value, expires_in: expires, token_type: 'Bearer' });
function request(path = POINT, init = {}, direct = true) {
  const target = new URL(path, BASE);
  if (direct) {
    const url = new URL('/api/relay', BASE);
    url.searchParams.set('path', target.pathname.slice(1));
    for (const [key, value] of target.searchParams) url.searchParams.append(key, value);
    return new Request(url, { headers: { Origin: ORIGIN }, ...init });
  }
  return new Request(target, { headers: { Origin: ORIGIN }, ...init });
}

test('Vercel Web handler responds to health without claiming to check providers', async () => {
  const response = await handler.fetch(request('/health'));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.build, BUILD);
  assert.equal(body.platform, 'vercel-node');
  assert.equal(body.upstreamChecked, false);
  assert.deepEqual(body.timeoutsMs, LIMITS);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
});

test('health reports missing, partial and complete configuration without revealing credentials', async () => {
  const relay = createRelay({ fetchUpstream: () => { throw Error('Health must not call a provider'); } });
  for (const [env, mode] of [[{}, 'anonymous'], [{ OPENSKY_CLIENT_ID: ENV.OPENSKY_CLIENT_ID }, 'incomplete'], [ENV, 'oauth']]) {
    const response = await relay(request('/health'), env);
    const text = await response.text();
    assert.equal(JSON.parse(text).openskyAuthentication, mode);
    assert.equal(text.includes(ENV.OPENSKY_CLIENT_ID), false);
    assert.equal(text.includes(ENV.OPENSKY_CLIENT_SECRET), false);
  }
  assert.equal((await relay(request(BOX), { OPENSKY_CLIENT_ID: 'only-one' })).status, 503);
});

test('GitHub, own domain and configured domains get CORS; unrelated origins and unsafe methods do not', async () => {
  const relay = createRelay();
  for (const origin of [ORIGIN, BASE, 'https://sky.example']) {
    const response = await relay(request('/health', { headers: { Origin: origin } }), { ALLOWED_ORIGINS: 'https://sky.example' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  }
  const denied = await relay(request('/health', { headers: { Origin: 'https://other.vercel.app' } }));
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal((await relay(request('/health', { method: 'POST' }))).status, 405);
  const preflight = await relay(request(BOX, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET' } }));
  assert.equal(preflight.status, 204);
  assert.equal(await preflight.text(), '');
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal((await relay(request(BOX, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Headers': 'Authorization' } }))).status, 400);
});

test('canonical and rewritten paths target only the fixed upstream and preserve query parameters', async () => {
  const seen = [];
  const relay = createRelay({ fetchUpstream: async (url, options) => {
    seen.push(url);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json(url.includes('opensky') ? snapshot() : planes());
  } });
  assert.equal((await relay(request(POINT))).status, 200);
  assert.equal(seen[0], 'https://opendata.adsb.fi/api/v3/lat/48.47377/lon/7.94495/dist/54');
  assert.equal((await relay(request(POINT.replace('adsbfi', 'adsb'), {}, false))).status, 200);
  assert.equal(seen[1], 'https://api.adsb.lol/v2/point/48.47377/7.94495/54');
  assert.equal((await relay(request(BOX))).status, 200);
  assert.equal(seen[2], 'https://opensky-network.org/api/states/all?lamin=47.57445&lamax=49.37309&lomin=6.58836&lomax=9.30154');
  assert.equal((await relay(request('/health', {}, false))).status, 200);
});

test('invalid paths, coordinates and duplicate query parameters never reach a provider', async () => {
  let calls = 0;
  const relay = createRelay({ fetchUpstream: () => { calls++; throw Error('Must not fetch'); } });
  for (const path of ['/https://evil.example', '/adsb/point/91/8/20', '/adsb/point/50/8/999', '/adsb/point/50/8/20?url=https://evil.example',
    BOX + '&lamin=47', BOX.replace('lamax=49.37309', 'lamax=90'), BOX.replace('lamax=49.37309', 'lamax=40'),
    BOX.replace('lomin=6.58836', 'lomin=200'), '/api/relay?path=health&path=health']) {
    assert.equal((await relay(request(path))).status, 400, path);
  }
  assert.equal(calls, 0);
});

test('tokens are URL encoded, reused, and never sent to ADS-B providers or returned to browsers', async () => {
  let authCalls = 0, dataCalls = 0;
  const relay = createRelay({ fetchUpstream: async (url, options) => {
    if (url === TOKEN) {
      authCalls++;
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'manual');
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('client_id'), ENV.OPENSKY_CLIENT_ID);
      assert.equal(form.get('client_secret'), ENV.OPENSKY_CLIENT_SECRET);
      assert.equal(form.get('grant_type'), 'client_credentials');
      return tokenResponse();
    }
    dataCalls++;
    assert.equal(options.headers.Authorization, url.includes('opensky-network.org') ? 'Bearer private-token' : undefined);
    return Response.json(url.includes('opensky-network.org') ? snapshot() : planes());
  } });
  for (const path of [BOX, BOX.replace('6.58836', '6.50000'), POINT]) {
    const response = await relay(request(path), ENV);
    assert.equal(response.status, 200);
    const text = await response.text();
    for (const value of [...Object.values(ENV), 'private-token']) assert.equal(text.includes(value), false);
  }
  assert.equal(authCalls, 1);
  assert.equal(dataCalls, 3);
});

test('concurrent identical flight requests coalesce into one upstream request', async () => {
  let calls = 0, release;
  const relay = createRelay({ fetchUpstream: () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  const first = relay(request(POINT));
  const second = relay(request(POINT));
  await new Promise(resolve => setImmediate(resolve));
  release(Response.json(planes()));
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.equal(calls, 1);
});

test('concurrent OpenSky boxes share token acquisition but retain their separate data', async () => {
  let authCalls = 0, dataCalls = 0, release;
  const relay = createRelay({ fetchUpstream: async url => {
    if (url === TOKEN) { authCalls++; return new Promise(resolve => { release = resolve; }); }
    dataCalls++;
    return Response.json(snapshot());
  } });
  const requests = [relay(request(BOX), ENV), relay(request(BOX.replace('6.58836', '6.5')), ENV)];
  await new Promise(resolve => setImmediate(resolve));
  release(tokenResponse());
  for (const response of await Promise.all(requests)) assert.equal(response.status, 200);
  assert.equal(authCalls, 1);
  assert.equal(dataCalls, 2);
});

test('cached data retains original observation timestamps and expires', async () => {
  let time = 1700000000000, calls = 0;
  const data = planes();
  const relay = createRelay({ now: () => time, fetchUpstream: async () => { calls++; return Response.json(data); } });
  await relay(request(POINT));
  time += 10000;
  const cached = await relay(request(POINT));
  assert.equal(cached.headers.get('X-Flightscan-Cache'), 'HIT');
  assert.deepEqual(await cached.json(), data);
  assert.equal(calls, 1);
  time += 20000;
  assert.equal((await relay(request(POINT))).headers.get('X-Flightscan-Cache'), 'MISS');
  assert.equal(calls, 2);
});

test('expired tokens refresh and a data 401 is retried only once', async () => {
  let time = 1700000000000, authCalls = 0, dataCalls = 0;
  const relay = createRelay({ now: () => time, fetchUpstream: async url => {
    if (url === TOKEN) return tokenResponse('token-' + ++authCalls, 100);
    dataCalls++;
    return dataCalls <= 2 ? new Response(null, { status: 401 }) : Response.json(snapshot());
  } });
  assert.equal((await relay(request(BOX), ENV)).status, 401);
  assert.equal(authCalls, 2);
  assert.equal(dataCalls, 2);
  time += 3600001;
  assert.equal((await relay(request(BOX), ENV)).status, 200);
  assert.equal(authCalls, 3);
});

test('auth rejection and redirects are readable without exposing sensitive upstream responses', async () => {
  for (const status of [401, 302]) {
    let calls = 0;
    const relay = createRelay({ fetchUpstream: async () => { calls++; return new Response(ENV.OPENSKY_CLIENT_SECRET, { status, headers: { Location: 'https://evil.example' } }); } });
    const response = await relay(request(BOX), ENV);
    const text = await response.text();
    const body = JSON.parse(text);
    assert.equal(response.status, 502);
    assert.equal(body.stage, 'authentication');
    assert.equal(body.code, status === 302 ? 'OPENSKY_AUTH_REDIRECT' : 'OPENSKY_AUTH_REJECTED');
    assert.equal(text.includes(ENV.OPENSKY_CLIENT_SECRET), false);
    assert.equal(response.headers.get('Location'), null);
    await relay(request(BOX), ENV);
    assert.equal(calls, 1);
  }
});

test('Retry-After is honored across coordinates, while other providers remain available', async () => {
  let calls = 0, time = 1700000000000;
  const relay = createRelay({ now: () => time, fetchUpstream: async url => {
    calls++;
    return url.includes('adsb.fi') ? new Response('Quota', { status: 429, headers: { 'Retry-After': new Date(time + 60000).toUTCString() } }) : Response.json(planes());
  } });
  const first = await relay(request(POINT));
  assert.equal(first.status, 429);
  assert.equal(first.headers.get('Retry-After'), '60');
  assert.equal(first.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  time += 10000;
  const second = await relay(request(POINT.replace('48.47377', '50.11552')));
  const body = await second.json();
  assert.equal(body.cooldown, true);
  assert.equal(body.retryAfter, 50);
  assert.equal(calls, 1);
  assert.equal((await relay(request(POINT.replace('adsbfi', 'adsb')))).status, 200);
  assert.equal(calls, 2);
});

test('an anonymous OpenSky quota does not prevent a configured account request', async () => {
  const relay = createRelay({ fetchUpstream: async (url, options) => url === TOKEN ? tokenResponse()
    : options.headers.Authorization ? Response.json(snapshot()) : new Response('Quota', { status: 429 }) });
  assert.equal((await relay(request(BOX))).status, 429);
  assert.equal((await relay(request(BOX), ENV)).status, 200);
});

test('hard authentication deadline returns JSON even when the transport ignores abort', async () => {
  let signal, calls = 0;
  const relay = createRelay({ limits: { ...LIMITS, auth: 10, opensky: 100 }, fetchUpstream: (url, options) => {
    assert.equal(url, TOKEN);
    signal = options.signal; calls++;
    return new Promise(() => {});
  } });
  const response = await relay(request(BOX), ENV);
  assert.equal(response.status, 504);
  assert.equal(signal.aborted, true);
  assert.equal((await response.json()).code, 'OPENSKY_AUTH_TIMEOUT');
  assert.equal(response.headers.get('Retry-After'), '120');
  await relay(request(BOX), ENV);
  assert.equal(calls, 1);
});

test('complete request deadline includes a hanging data body after successful authentication', async () => {
  const relay = createRelay({ limits: { ...LIMITS, auth: 10, opensky: 20 }, fetchUpstream: async url => url === TOKEN ? tokenResponse()
    : { ok: true, status: 200, json: () => new Promise(() => {}) } });
  const response = await relay(request(BOX), ENV);
  const body = await response.json();
  assert.equal(response.status, 504);
  assert.equal(body.code, 'UPSTREAM_TIMEOUT');
  assert.equal(body.stage, 'flight-data');
});

test('overall deadline also bounds waiting on authentication and retains the correct stage', async () => {
  const relay = createRelay({ limits: { ...LIMITS, auth: 30, opensky: 10 }, fetchUpstream: () => new Promise(() => {}) });
  const response = await relay(request(BOX), ENV);
  const body = await response.json();
  assert.equal(response.status, 504);
  assert.equal(body.code, 'OPENSKY_AUTH_TIMEOUT');
  assert.equal(body.stage, 'authentication');
});

test('Node connection errors expose a diagnostic code but not raw exception text', async () => {
  const relay = createRelay({ fetchUpstream: async () => { throw new TypeError(ENV.OPENSKY_CLIENT_SECRET, { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }); } });
  const response = await relay(request(BOX), ENV);
  const text = await response.text();
  assert.equal(response.status, 502);
  assert.equal(JSON.parse(text).networkCode, 'UND_ERR_CONNECT_TIMEOUT');
  assert.equal(JSON.parse(text).stage, 'authentication');
  assert.equal(text.includes(ENV.OPENSKY_CLIENT_SECRET), false);
});

test('invalid JSON, invalid data and redirects cannot appear as successful empty flight snapshots', async () => {
  for (const makeResponse of [() => new Response('<html>error</html>'), () => Response.json({ error: 'No data' }),
    () => new Response(null, { status: 302, headers: { Location: 'https://evil.example' } })]) {
    const relay = createRelay({ fetchUpstream: async () => makeResponse() });
    const response = await relay(request(POINT));
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    assert.equal(response.headers.get('Location'), null);
    assert.ok((await response.json()).code.startsWith('UPSTREAM_'));
  }
});
