export function readNumber(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  const value = Number.parseInt(raw || '', 10);
  return Number.isFinite(value) ? value : fallback;
}

export function readString(key: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  return value || fallback;
}

export function readBool(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
}
