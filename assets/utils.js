// /assets/utils.js
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const ls = {
  get: (k, d = null) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
    catch { return d; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch {}
  },
  remove: (k) => {
    try { localStorage.removeItem(k); } catch {}
  }
};

export const fmtMs = v => (v == null ? '—' : Math.round(v).toString());

// Stable anonymous device id (cached in localStorage)
export function getDeviceId() {
  let id = ls.get('device.id', null);
  if (!id) {
    id = cryptoRandomId();
    ls.set('device.id', id);
  }
  return id;
}

function cryptoRandomId() {
  // 24-char url-safe random id
  const arr = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, '').slice(0, 24);
}

// YYYYMMDD (UTC) – ώστε όλοι να παίζουν την ίδια “μέρα”
export function todayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Small fetch helper with JSON parse + error bubble
export async function fetchJSON(url, opts) {
  const r = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.error || `HTTP ${r.status}`);
    err.data = data;
    throw err;
  }
  return data;
}
