import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

function memoryStorage(values = new Map()) {
  return { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
let clientNumber = 0;
async function loadClient() {
  const source = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}#${clientNumber++}`);
}

test('API client signs in, shares refresh, revokes the rotated token, and clears expired sessions', async () => {
  const stored = new Map();
  globalThis.sessionStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key),
  };
  globalThis.window = new EventTarget();
  globalThis.localStorage = memoryStorage();
  const source = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  const { api, hasSession, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const originalFetch = globalThis.fetch;
  let generation = 0;
  let requiredGeneration = 1;
  let refreshes = 0;
  let rejectRefresh = false;
  const reply = (value, status = 200) => new Response(JSON.stringify(value), { status });
  const tokens = () => ({ access_token: `access-${generation}`, refresh_token: `refresh-${generation}`, expires_in: 900 });
  globalThis.fetch = async (path, options) => {
    if (path.endsWith('/auth/otp/request')) {
      assert.equal(options.headers['Accept-Language'], 'kn');
      assert.equal(JSON.parse(options.body).role, 'farmer');
      return reply({ code: 'OTP_SENT', expires_in: 300 });
    }
    if (path.endsWith('/auth/otp/verify')) return reply(tokens());
    if (path.endsWith('/auth/refresh')) {
      refreshes += 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      if (rejectRefresh) return reply({ code: 'UNAUTHENTICATED', message: 'Log in again.' }, 401);
      generation += 1;
      return reply(tokens());
    }
    if (options.headers.Authorization !== `Bearer access-${requiredGeneration}`) return reply({ code: 'UNAUTHENTICATED' }, 401);
    if (path.endsWith('/auth/logout')) {
      assert.equal(JSON.parse(options.body).refresh_token, `refresh-${generation}`);
      return reply({ code: 'LOGGED_OUT' });
    }
    if (path.endsWith('/farms')) return reply([]);
    if (path.endsWith('/harvests')) return reply({ code: 'HIGH_QUANTITY_CONFIRMATION_REQUIRED', message: 'Confirm quantity.' }, 400);
    return reply({ id: 1, name: null, language: 'kn' });
  };
  try {
    await api.requestOtp('9876543210', 'kn');
    await api.verifyOtp('9876543210', '123456');
    assert.equal(hasSession(), true);
    await Promise.all([api.profile(), api.farms()]);
    assert.equal(refreshes, 1, 'concurrent 401s should share a refresh');
    await assert.rejects(api.createHarvest({}), error => error instanceof ApiError && error.code === 'HIGH_QUANTITY_CONFIRMATION_REQUIRED');
    requiredGeneration = 2;
    await api.logout();
    assert.equal(refreshes, 2);
    assert.equal(hasSession(), false);
    assert.equal(stored.size, 0);
    await api.verifyOtp('9876543210', '123456');
    requiredGeneration = 3;
    rejectRefresh = true;
    await assert.rejects(api.profile(), error => error.status === 401);
    assert.equal(hasSession(), false);
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(api.requestOtp('9876543210', 'en'), error => error.code === 'NETWORK_ERROR');
  } finally { globalThis.fetch = originalFetch; }
});

test('a remembered number survives logout but never authenticates the user', async () => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  globalThis.window = new EventTarget();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 900 }));
  try {
    const client = await loadClient();
    assert.equal(client.getRememberedPhone(), null);
    await client.api.verifyOtp('9876543210', '123456', true);
    client.rememberPhone('9876543210', 'kn');
    assert.ok(localStorage.getItem('agrivalue.session'));
    assert.equal(sessionStorage.getItem('agrivalue.session'), null);
    globalThis.sessionStorage = memoryStorage(); // A fresh tab/browser visit.
    const returning = await loadClient();
    assert.equal(returning.hasSession(), true);
    await returning.api.logout();
    assert.equal(localStorage.getItem('agrivalue.session'), null);
    const signedOut = await loadClient();
    assert.equal(signedOut.hasSession(), false);
    assert.deepEqual(signedOut.getRememberedPhone(), { phone: '9876543210', language: 'kn' });
    signedOut.forgetPhone();
    assert.equal(signedOut.getRememberedPhone(), null);
    localStorage.setItem('agrivalue.remembered-phone', '{broken');
    assert.equal(signedOut.getRememberedPhone(), null);
  } finally { globalThis.fetch = originalFetch; }
});

test('shared-device mode ends on tab close and failed OTP verification saves no session', async () => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  globalThis.window = new EventTarget();
  const originalFetch = globalThis.fetch;
  try {
    const client = await loadClient();
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'OTP_INVALID', message: 'Incorrect OTP.' }), { status: 401 });
    await assert.rejects(client.api.verifyOtp('9876543210', '000000', true));
    assert.equal(client.hasSession(), false);
    assert.equal(localStorage.getItem('agrivalue.session'), null);
    globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 900 }));
    await client.api.verifyOtp('9876543210', '123456', false);
    assert.ok(sessionStorage.getItem('agrivalue.session'));
    assert.equal(localStorage.getItem('agrivalue.session'), null);
    assert.equal((await loadClient()).hasSession(), true); // Reload in the same tab.
    globalThis.sessionStorage = memoryStorage();
    assert.equal((await loadClient()).hasSession(), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('persistent sessions share token rotation across tabs and observe sign-out', async () => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  globalThis.window = new EventTarget();
  const originalFetch = globalThis.fetch;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let queue = Promise.resolve();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    request: (_name, callback) => { const next = queue.then(callback); queue = next.catch(() => {}); return next; },
  } } });
  let refreshes = 0;
  const reply = (value, status = 200) => new Response(JSON.stringify(value), { status });
  globalThis.fetch = async (path, options) => {
    if (path.endsWith('/auth/otp/verify')) return reply({ access_token: 'old', refresh_token: 'old-refresh' });
    if (path.endsWith('/auth/refresh')) {
      refreshes += 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      return reply({ access_token: 'new', refresh_token: 'new-refresh' });
    }
    if (options.headers.Authorization === 'Bearer old') return reply({ code: 'UNAUTHENTICATED' }, 401);
    return reply({ id: 1 });
  };
  try {
    const first = await loadClient();
    await first.api.verifyOtp('9876543210', '123456', true);
    const second = await loadClient();
    await Promise.all([first.api.profile(), second.api.profile()]);
    assert.equal(refreshes, 1);
    first.clearSession();
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: 'agrivalue.session' });
    window.dispatchEvent(event);
    assert.equal(second.hasSession(), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});

test('an in-flight refresh cannot restore a cleared session', async () => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  globalThis.window = new EventTarget();
  const originalFetch = globalThis.fetch;
  let release;
  let started;
  const refreshStarted = new Promise(resolve => { started = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async path => {
    if (path.endsWith('/auth/otp/verify')) return new Response(JSON.stringify({ access_token: 'old', refresh_token: 'refresh' }));
    if (path.endsWith('/auth/refresh')) { started(); await blocked; return new Response(JSON.stringify({ access_token: 'new', refresh_token: 'rotated' })); }
    return new Response(JSON.stringify({ code: 'UNAUTHENTICATED' }), { status: 401 });
  };
  try {
    const client = await loadClient();
    await client.api.verifyOtp('9876543210', '123456', false);
    const pending = client.api.profile();
    await refreshStarted;
    client.clearSession();
    release();
    await assert.rejects(pending);
    assert.equal(client.hasSession(), false);
    assert.equal(sessionStorage.getItem('agrivalue.session'), null);
  } finally { globalThis.fetch = originalFetch; }
});
