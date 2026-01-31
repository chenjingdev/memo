export type IdOptions = {
  useNum: boolean;
  useLow: boolean;
  useUp: boolean;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeOptions(opts: IdOptions): IdOptions {
  if (!opts.useNum && !opts.useLow && !opts.useUp) {
    return { ...opts, useNum: true };
  }
  return opts;
}

export function generateCustomId(len: number, opts: IdOptions) {
  const { useNum, useLow, useUp } = normalizeOptions(opts);
  let chars = '';
  if (useNum) chars += '0123456789';
  if (useLow) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (useUp) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (!chars) chars = '0123456789';

  let result = '';
  const random = new Uint8Array(len);
  window.crypto.getRandomValues(random);
  for (let i = 0; i < len; i += 1) {
    result += chars[random[i] % chars.length];
  }
  return result;
}

export function generateKeyString(len: number, opts: IdOptions) {
  return generateCustomId(len, opts);
}

export function normalizeKey(input: string) {
  return (input || '').replace(/[^A-Za-z0-9]/g, '');
}
