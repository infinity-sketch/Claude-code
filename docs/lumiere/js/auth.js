// Single-user passcode lock. The data lives on this device, so this protects the app
// from anyone else picking up the phone — it is not server-side authentication.
import { db } from './db.js';

const SESSION_KEY = 'lumiere-unlocked';
const REMEMBER_KEY = 'lumiere-remember';
const ITERATIONS = 150000;

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function derive(passcode, salt, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return b64(bits);
}

export async function hasPasscode() {
  return Boolean(await db.get('meta', 'auth'));
}

export async function setPasscode(passcode) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(passcode, salt);
  await db.put('meta', { id: 'auth', salt: b64(salt), hash, iterations: ITERATIONS });
}

export async function verify(passcode) {
  const rec = await db.get('meta', 'auth');
  if (!rec) return false;
  const hash = await derive(passcode, unb64(rec.salt), rec.iterations);
  return hash === rec.hash;
}

// Fresh random token per unlock, so a copied flag from another device is meaningless.
export function markUnlocked(remember) {
  const token = b64(crypto.getRandomValues(new Uint8Array(12)));
  sessionStorage.setItem(SESSION_KEY, token);
  try {
    if (remember) localStorage.setItem(REMEMBER_KEY, token);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch { /* storage may be unavailable in private mode */ }
}

export function isUnlocked() {
  try {
    return Boolean(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(REMEMBER_KEY));
  } catch {
    return false;
  }
}

export function lock() {
  sessionStorage.removeItem(SESSION_KEY);
  try { localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
}

export const cryptoAvailable = () => Boolean(globalThis.crypto?.subtle);
