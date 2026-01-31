import { KDF_ITERATIONS } from './constants';
import { normalizeKey } from './id';

type Payload = {
  ciphertext: string;
  iv: string;
  salt: string;
  kdf?: { iterations?: number };
};

export function bufferToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

export function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export async function deriveKeyFromPasscode(
  passcode: string,
  salt: Uint8Array,
  usages: KeyUsage[],
  iterations = KDF_ITERATIONS
) {
  const enc = new TextEncoder();
  const saltBytes: Uint8Array<ArrayBuffer> = new Uint8Array(salt);
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(normalizeKey(passcode)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  );
}

export async function encryptWithKey(text: string, key: CryptoKey) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipher = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(text)
  );
  return {
    ciphertext: bufferToBase64(new Uint8Array(cipher)),
    iv: bufferToBase64(iv),
  };
}

export async function decryptPayload(data: Payload, passcode: string) {
  if (!data?.salt) throw new Error('Invalid data');
  const salt = base64ToBytes(data.salt);
  const iterations = data?.kdf?.iterations || KDF_ITERATIONS;
  const key = await deriveKeyFromPasscode(passcode, salt, ['decrypt'], iterations);
  const iv = base64ToBytes(data.iv);
  const cipher = base64ToBytes(data.ciphertext);
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(decrypted);
}
