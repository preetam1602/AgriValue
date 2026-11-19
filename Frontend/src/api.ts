export type Language = 'en' | 'kn';
type Tokens = { access_token: string; refresh_token: string; expires_in: number };
export type Profile = { id: number; name: string | null; language: Language; role: string; status: string };
export type Farm = { id: number; district: string; village: string; area_acres: string };
export type Harvest = { id: number; farm_id: number; crop: string; variety: string; grade: string; quantity_qtl: string; harvest_date: string; latest_sale_date: string; warnings: string[] };
export type ReferenceData = { pilot_districts: string[]; allow_manual_district?: boolean; crops: Record<string, { varieties: string[]; grades: string[]; bag_weight_kg: number | null }>; max_storage_months: number; max_farm_acres: number; date_limits?: { harvest_min: string; harvest_max: string; sale_min: string; sale_max: string } };

const storageKey = 'agrivalue.session';
const phoneKey = 'agrivalue.remembered-phone';
type RememberedPhone = { phone: string; language: Language };
function readTokens(storage: Storage): Tokens | null {
  try {
    const value = JSON.parse(storage.getItem(storageKey) ?? 'null');
    return typeof value?.access_token === 'string' && typeof value?.refresh_token === 'string' ? value : null;
  } catch { return null; }
}
let tokens: Tokens | null = null;
let persistentSession = false;
try { tokens = readTokens(localStorage); persistentSession = Boolean(tokens); } catch { /* Storage may be unavailable. */ }
try { tokens ??= readTokens(sessionStorage); } catch { /* Start signed out. */ }
let language: Language = 'en';
let refreshing: Promise<void> | null = null;
let sessionVersion = 0;

export function getRememberedPhone(): RememberedPhone | null {
  try {
    const value = JSON.parse(localStorage.getItem(phoneKey) ?? 'null');
    return typeof value?.phone === 'string' && /^[6-9][0-9]{9}$/.test(value.phone) && ['en', 'kn'].includes(value?.language) ? value : null;
  } catch { return null; }
}
export function rememberPhone(phone: string, preferred: Language) {
  try { localStorage.setItem(phoneKey, JSON.stringify({ phone, language: preferred })); } catch { /* Sign-in can continue without remembering. */ }
}
export function forgetPhone() {
  try { localStorage.removeItem(phoneKey); } catch { /* Storage may be unavailable. */ }
}
function removeStoredSessions() {
  try { localStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
  try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Unable to complete the request. Please retry.'; }
export function setLanguage(value: Language) { language = value; }
export function hasSession() { return Boolean(tokens?.access_token && tokens?.refresh_token); }
export function clearSession() {
  sessionVersion += 1;
  tokens = null;
  removeStoredSessions();
  window.dispatchEvent(new Event('sessionchange'));
}
function saveSession(value: Tokens) {
  tokens = value;
  try {
    const storage = persistentSession ? localStorage : sessionStorage;
    storage.setItem(storageKey, JSON.stringify(value));
  } catch {
    persistentSession = false;
    try { sessionStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Keep an in-memory session if storage is blocked. */ }
  }
  window.dispatchEvent(new Event('sessionchange'));
}

window.addEventListener('storage', event => {
  const change = event as StorageEvent;
  if (change.key !== storageKey && change.key !== null) return;
  if (!persistentSession) return;
  try { tokens = readTokens(localStorage); } catch { tokens = null; }
  sessionVersion += 1;
  window.dispatchEvent(new Event('sessionchange'));
});

async function refreshSession() {
  const version = sessionVersion;
  const expiredAccess = tokens?.access_token;
  const refresh = async () => {
    if (version !== sessionVersion || !tokens) throw new ApiError('UNAUTHENTICATED', 'Please sign in again.', 401);
    if (persistentSession) {
      // Another tab may have rotated the token while this tab waited for the lock.
      const stored = readTokens(localStorage);
      if (!stored) { clearSession(); throw new ApiError('UNAUTHENTICATED', 'Please sign in again.', 401); }
      tokens = stored;
      if (tokens.access_token !== expiredAccess) return;
    }
    const updated = await request<Tokens>('/auth/refresh', 'POST', { refresh_token: tokens.refresh_token }, false);
    if (version !== sessionVersion) throw new ApiError('UNAUTHENTICATED', 'Please sign in again.', 401);
    saveSession(updated);
  };
  try {
    if (persistentSession && typeof navigator !== 'undefined' && navigator.locks) {
      await navigator.locks.request('agrivalue.session-refresh', refresh);
    } else { await refresh(); }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && version === sessionVersion) clearSession();
    throw error;
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown, authenticated = true, retry = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept-Language': language,
        ...(authenticated && tokens ? { Authorization: `Bearer ${tokens.access_token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.', 0); }
  if (response.status === 401 && authenticated && tokens && retry) {
    if (!refreshing) {
      refreshing = refreshSession().finally(() => { refreshing = null; });
    }
    await refreshing;
    return request<T>(path, method, path === '/auth/logout' && tokens ? { refresh_token: tokens.refresh_token } : body, authenticated, false);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && authenticated) clearSession();
    throw new ApiError(result?.code ?? 'REQUEST_FAILED', result?.message ?? 'The server could not complete the request. Please retry.', response.status);
  }
  return result as T;
}

export const api = {
  reverseLocation: (latitude: number, longitude: number) => request<{ district: string; village: string }>('/location/reverse', 'POST', { latitude, longitude }),
  requestOtp: (phone: string, preferred: Language) => {
    setLanguage(preferred);
    return request<{ code: string; expires_in: number; demo_otp?: string }>('/auth/otp/request', 'POST', { phone, language: preferred, role: 'farmer' }, false);
  },
  verifyOtp: async (phone: string, otp: string, keepSignedIn = false) => {
    const value = await request<Tokens>('/auth/otp/verify', 'POST', { phone, otp }, false);
    sessionVersion += 1;
    removeStoredSessions();
    persistentSession = keepSignedIn;
    saveSession(value);
  },
  logout: async () => {
    try { if (tokens) await request('/auth/logout', 'POST', { refresh_token: tokens.refresh_token }); }
    finally { clearSession(); }
  },
  profile: () => request<Profile>('/me'),
  updateProfile: (name: string, preferred: Language) => request<Profile>('/me', 'PUT', { name: name.trim() || null, language: preferred }),
  farms: () => request<Farm[]>('/farms'),
  harvests: () => request<Harvest[]>('/harvests'),
  deleteHarvest: (id: number) => request<void>(`/harvests/${id}`, 'DELETE'),
  referenceData: () => request<ReferenceData>('/reference-data'),
  createFarm: (body: unknown) => request<Farm>('/farms', 'POST', body),
  createHarvest: (body: unknown) => request<Harvest>('/harvests', 'POST', body),
  saveHarvestRecord: (body: unknown) => request<{ farm: Farm; harvest: Harvest }>('/harvest-records', 'POST', body),
};
