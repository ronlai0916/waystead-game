// The grown-up PIN: 4 digits, kept only as a salted SHA-256 hash ("wb.pin").
// A gate to keep children from allowing words, not a lock: anyone with the
// device can clear it ("Forgot PIN?" also clears the allowed words).
// The crypto object is passed in so the same code runs in Node for the tests.

export const PIN_RE = /^\d{4}$/;

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashPin(pin, salt, subtle = globalThis.crypto.subtle) {
  return hex(await subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)));
}

// A new stored PIN: { salt, hash }. Throws unless pin is 4 digits.
export async function makePin(pin, c = globalThis.crypto) {
  if (!PIN_RE.test(pin)) throw new Error('A PIN is 4 digits');
  const salt = hex(c.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await hashPin(pin, salt, c.subtle) };
}

export function isStoredPin(stored) {
  return !!stored && typeof stored.salt === 'string' && /^[0-9a-f]{64}$/.test(stored.hash || '');
}

export async function checkPin(pin, stored, subtle = globalThis.crypto.subtle) {
  if (!isStoredPin(stored) || !PIN_RE.test(String(pin))) return false;
  return (await hashPin(String(pin), stored.salt, subtle)) === stored.hash;
}
