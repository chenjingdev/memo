import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCcw, Save, Share2 } from 'lucide-react';

const API_BASE = '/api/memo';
const ID_RE = /^[A-Za-z0-9]{4,32}$/;
const KEY_MIN_LEN = 4;
const KEY_MAX_LEN = 32;
const KDF_ITERATIONS = 100000;
const TTL_MINUTES = 30;
const TTL_MS = TTL_MINUTES * 60 * 1000;
const POLL_INTERVAL_MS = 5000;
const MEMO_MAX_CHARS = 2000;

type IdOptions = {
  useNum: boolean;
  useLow: boolean;
  useUp: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readNumber(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  const value = Number.parseInt(raw || '', 10);
  return Number.isFinite(value) ? value : fallback;
}

function readString(key: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  return value || fallback;
}

function readBool(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
}

function normalizeOptions(opts: IdOptions): IdOptions {
  if (!opts.useNum && !opts.useLow && !opts.useUp) {
    return { ...opts, useNum: true };
  }
  return opts;
}

function generateCustomId(len: number, opts: IdOptions) {
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

function generateKeyString(len: number, opts: IdOptions) {
  return generateCustomId(len, opts);
}

function normalizeKey(input: string) {
  return (input || '').replace(/[^A-Za-z0-9]/g, '');
}

type GraphemeSegmenter = {
  segment: (input: string) => Iterable<{ segment: string }>;
};

const graphemeSegmenter: GraphemeSegmenter | null = (() => {
  if (typeof Intl === 'undefined') return null
  const Segmenter = (Intl as { Segmenter?: new (...args: any[]) => GraphemeSegmenter }).Segmenter;
  return Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : null;
})();

function getCharCount(value: string) {
  if (!value) return 0;
  if (!graphemeSegmenter) return Array.from(value).length;
  let count = 0;
  for (const _ of graphemeSegmenter.segment(value)) {
    count += 1;
  }
  return count;
}

function clampTextByChars(value: string, maxChars: number) {
  if (!value) return value;
  if (!graphemeSegmenter) {
    const chars = Array.from(value);
    return chars.length <= maxChars ? value : chars.slice(0, maxChars).join('');
  }

  let count = 0;
  let result = '';
  for (const part of graphemeSegmenter.segment(value)) {
    if (count >= maxChars) break;
    result += part.segment;
    count += 1;
  }
  return result;
}

function bufferToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function buildShareLink(id: string, key: string) {
  if (!id || !key) return '';
  if (typeof window === 'undefined') return `/${id}#${key}`;
  return `${window.location.origin}/${id}#${key}`;
}

function parseRoute() {
  if (typeof window === 'undefined') return { id: null, key: null };
  const pathMatch = window.location.pathname.match(/^\/([A-Za-z0-9]+)$/);
  let id = pathMatch ? pathMatch[1] : null;

  const hash = window.location.hash;
  let key: string | null = null;
  if (hash && hash.length > 1) {
    const raw = hash.substring(1);
    if (raw.includes('=')) {
      const params = new URLSearchParams(raw);
      if (params.has('id')) id = params.get('id');
      if (params.has('k')) key = params.get('k');
    } else {
      key = raw;
    }
  }

  return { id, key };
}

async function deriveKeyFromPasscode(
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

async function encryptWithKey(text: string, key: CryptoKey) {
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

async function decryptPayload(data: any, passcode: string) {
  if (!data?.salt) throw new Error('Invalid data');
  const salt = base64ToBytes(data.salt);
  const iterations = data?.kdf?.iterations || KDF_ITERATIONS;
  const key = await deriveKeyFromPasscode(passcode, salt, ['decrypt'], iterations);
  const iv = base64ToBytes(data.iv);
  const cipher = base64ToBytes(data.ciphertext);
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(decrypted);
}

const initialTheme = readString('memo-theme', 'classic');
const initialIdLength = clamp(readNumber('memo-id-len', 4), KEY_MIN_LEN, KEY_MAX_LEN);
const initialKeyLength = clamp(readNumber('memo-key-len', 4), KEY_MIN_LEN, KEY_MAX_LEN);
const initialOptions = normalizeOptions({
  useNum: readBool('memo-id-num', true),
  useLow: readBool('memo-id-low', false),
  useUp: readBool('memo-id-up', false),
});

export default function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [memoText, setMemoText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [idLength, setIdLength] = useState(initialIdLength);
  const [keyLength, setKeyLength] = useState(initialKeyLength);
  const [useNum, setUseNum] = useState(initialOptions.useNum);
  const [useLow, setUseLow] = useState(initialOptions.useLow);
  const [useUp, setUseUp] = useState(initialOptions.useUp);

  const [generatedId, setGeneratedId] = useState(() =>
    generateCustomId(initialIdLength, initialOptions)
  );
  const [keyString, setKeyString] = useState(() =>
    generateKeyString(initialKeyLength, initialOptions)
  );
  const shareLink = useMemo(
    () => buildShareLink(generatedId, keyString),
    [generatedId, keyString]
  );

  const [view, setView] = useState<'write' | 'read'>('write');
  const [readContent, setReadContent] = useState('');
  const [readError, setReadError] = useState(false);
  const [readPlaceholder, setReadPlaceholder] = useState('Unsealing memo...');
  const [isSharing, setIsSharing] = useState(false);
  const [lastSharedId, setLastSharedId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'active' | 'expired' | 'error'>('idle');
  const [shareExpiresAt, setShareExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastRouteRef = useRef<string | null>(null);
  const lastSavedRef = useRef('');

  const themeClasses = useMemo(() => {
    switch (theme) {
      case 'plain':
        return {
          pageBg: 'bg-[#f0f0f0]',
          paperBg: 'bg-white',
          line: 'bg-none',
          marginLine: 'before:bg-transparent',
          text: 'text-black',
          brand: 'text-neutral-700',
          panelBg: 'bg-white',
          panelText: 'text-neutral-600',
          accent: 'text-[#0984e3]',
          accentBg: 'bg-[#0984e3]',
          accentInput: 'accent-[#0984e3]',
          badgeStrong: 'bg-emerald-200/60 text-emerald-700',
          badgeBasic: 'bg-neutral-200 text-neutral-700',
          statusIdle: 'bg-neutral-200 text-neutral-700',
          statusActive: 'bg-blue-500/15 text-blue-600',
          statusExpired: 'bg-orange-500/20 text-orange-700',
          statusError: 'bg-amber-500/25 text-amber-700',
          stamp: 'bg-[#2d3436] text-white',
        };
      case 'dark':
        return {
          pageBg: 'bg-[#1e272e]',
          paperBg: 'bg-[#2f3640]',
          line: 'bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)]',
          marginLine: 'before:bg-white/20',
          text: 'text-[#dcdde1]',
          brand: 'text-[#aaa]',
          panelBg: 'bg-[#2d3436]',
          panelText: 'text-slate-300',
          accent: 'text-[#74b9ff]',
          accentBg: 'bg-[#74b9ff]',
          accentInput: 'accent-[#74b9ff]',
          badgeStrong: 'bg-emerald-500/20 text-emerald-200',
          badgeBasic: 'bg-slate-600/40 text-slate-200',
          statusIdle: 'bg-slate-600/40 text-slate-200',
          statusActive: 'bg-[#74b9ff]/20 text-[#cfe7ff]',
          statusExpired: 'bg-orange-400/20 text-orange-200',
          statusError: 'bg-amber-400/20 text-amber-200',
          stamp: 'bg-[#74b9ff] text-[#0f172a]',
        };
      default:
        return {
          pageBg: 'bg-[#f0f0f0]',
          paperBg: 'bg-[#fffdf0]',
          line: 'bg-[linear-gradient(rgba(164,176,190,0.8)_1px,transparent_1px)]',
          marginLine: 'before:bg-[#ff7675]',
          text: 'text-[#2d3436]',
          brand: 'text-[#555]',
          panelBg: 'bg-white',
          panelText: 'text-neutral-600',
          accent: 'text-[#0984e3]',
          accentBg: 'bg-[#0984e3]',
          accentInput: 'accent-[#0984e3]',
          badgeStrong: 'bg-emerald-200/60 text-emerald-700',
          badgeBasic: 'bg-neutral-200 text-neutral-700',
          statusIdle: 'bg-neutral-200 text-neutral-700',
          statusActive: 'bg-blue-500/15 text-blue-600',
          statusExpired: 'bg-orange-500/20 text-orange-700',
          statusError: 'bg-amber-500/25 text-amber-700',
          stamp: 'bg-[#2d3436] text-white',
        };
    }
  }, [theme]);

  const statusPillClass = useMemo(() => {
    if (shareStatus === 'active') return themeClasses.statusActive;
    if (shareStatus === 'expired') return themeClasses.statusExpired;
    if (shareStatus === 'error') return themeClasses.statusError;
    return themeClasses.statusIdle;
  }, [shareStatus, themeClasses]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('memo-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('memo-id-len', String(idLength));
  }, [idLength]);

  useEffect(() => {
    window.localStorage.setItem('memo-key-len', String(keyLength));
  }, [keyLength]);

  useEffect(() => {
    window.localStorage.setItem('memo-id-num', String(useNum));
    window.localStorage.setItem('memo-id-low', String(useLow));
    window.localStorage.setItem('memo-id-up', String(useUp));
  }, [useNum, useLow, useUp]);

  useEffect(() => {
    if (lastSharedId) {
      window.localStorage.setItem('memo-last-id', lastSharedId);
    } else {
      window.localStorage.removeItem('memo-last-id');
    }
  }, [lastSharedId]);

  useEffect(() => {
    setGeneratedId(generateCustomId(idLength, { useNum, useLow, useUp }));
  }, [idLength, useNum, useLow, useUp]);

  useEffect(() => {
    setKeyString(generateKeyString(keyLength, { useNum, useLow, useUp }));
  }, [keyLength, useNum, useLow, useUp]);

  useEffect(() => {
    if (view !== 'write') return;
    const saved = window.localStorage.getItem('memo-draft');
    if (saved !== null) {
      const clipped = clampTextByChars(saved, MEMO_MAX_CHARS);
      setMemoText(clipped);
      lastSavedRef.current = clipped;
      setIsDirty(false);
    }
  }, [view]);

  useEffect(() => {
    if (view !== 'write') return;
    const el = textareaRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const maxHeight = Number.parseFloat(style.maxHeight || '');
    el.style.height = 'auto';
    if (Number.isFinite(maxHeight)) {
      const nextHeight = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${nextHeight}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    } else {
      el.style.height = `${el.scrollHeight}px`;
      el.style.overflowY = 'hidden';
    }
  }, [memoText, view]);

  useEffect(() => {
    if (view !== 'write') return;
    const handle = window.setInterval(() => {
      if (!isDirty) return;
      handleSave();
    }, 30000);
    return () => window.clearInterval(handle);
  }, [memoText, isDirty, view]);

  const handleSave = useCallback(() => {
    const clipped = clampTextByChars(memoText, MEMO_MAX_CHARS);
    window.localStorage.setItem('memo-draft', clipped);
    lastSavedRef.current = clipped;
    setIsDirty(false);
  }, [memoText]);

  const fetchAndDecrypt = useCallback(async (id: string, key: string) => {
    setReadContent('');
    setReadError(false);
    setReadPlaceholder('Unsealing memo...');
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Memo missing');
      const data = await res.json();
      const text = await decryptPayload(data, key);
      setReadContent(text);
    } catch {
      setReadError(true);
    }
  }, []);

  useEffect(() => {
    const handleRoute = () => {
      const pathname = window.location.pathname;
      const normalizedPath = pathname.replace(/\/+$/, '') || '/';
      if (['/login', '/signin', '/auth'].includes(normalizedPath)) {
        window.location.replace('/');
        return;
      }
      const { id, key } = parseRoute();
      const storedLastId = readString('memo-last-id', '');
      if (!id && storedLastId) {
        burnMemo(storedLastId);
        window.localStorage.removeItem('memo-last-id');
        setLastSharedId(null);
      }
      const routeKey = `${id ?? ''}#${key ?? ''}`;
      if (lastRouteRef.current === routeKey) {
        return;
      }
      lastRouteRef.current = routeKey;
      if (id && key) {
        setView('read');
        setReadError(false);
        setReadContent('');
        setReadPlaceholder('Unsealing memo...');
        fetchAndDecrypt(id, key);
        return;
      }

      if (id) {
        setView('read');
        setReadError(false);
        setReadContent('');
        setReadPlaceholder('Missing unlock key in the link.');
        return;
      }

      setView('write');
    };

    handleRoute();
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, [fetchAndDecrypt]);

  useEffect(() => {
    if (!lastSharedId) {
      setShareStatus('idle');
      return;
    }
    if (shareStatus === 'expired') return;

    let cancelled = false;
    let intervalId: number | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/${encodeURIComponent(lastSharedId)}`, {
          method: 'HEAD',
        });
        if (cancelled) return;
        if (res.status === 204) {
          setShareStatus('active');
          return;
        }
        if (res.status === 404) {
          setShareStatus('expired');
          if (intervalId) window.clearInterval(intervalId);
          return;
        }
        setShareStatus('error');
      } catch {
        if (!cancelled) setShareStatus('error');
      }
    };

    poll();
    intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [lastSharedId, shareStatus]);

  useEffect(() => {
    if (shareStatus !== 'active' || !shareExpiresAt) return;
    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [shareStatus, shareExpiresAt]);

  useEffect(() => {
    if (shareStatus !== 'active' || !shareExpiresAt) return;
    if (Date.now() >= shareExpiresAt) {
      setShareStatus('expired');
    }
  }, [shareStatus, shareExpiresAt, now]);

  const handleOptionToggle = (key: keyof IdOptions, value: boolean) => {
    const next = normalizeOptions({
      useNum: key === 'useNum' ? value : useNum,
      useLow: key === 'useLow' ? value : useLow,
      useUp: key === 'useUp' ? value : useUp,
    });
    setUseNum(next.useNum);
    setUseLow(next.useLow);
    setUseUp(next.useUp);
  };

  const handleRefresh = () => {
    setGeneratedId(generateCustomId(idLength, { useNum, useLow, useUp }));
    setKeyString(generateKeyString(keyLength, { useNum, useLow, useUp }));
  };

  const handleShare = async () => {
    if (!memoText.trim()) {
      console.warn('Share blocked: empty memo');
      return;
    }
    if (getCharCount(memoText) > MEMO_MAX_CHARS) {
      console.warn('Share blocked: memo too long');
      return;
    }
    const apiOk = await checkApiHealth();
    if (!apiOk) {
      console.warn('Share blocked: API unavailable');
      return;
    }
    setIsSharing(true);
    try {
      let candidateId = generatedId;
      let candidateKey = keyString;
      const maxAttempts = 5;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!ID_RE.test(candidateId)) {
          candidateId = generateCustomId(idLength, { useNum, useLow, useUp });
        }
        if (!candidateKey) {
          candidateKey = generateKeyString(keyLength, { useNum, useLow, useUp });
        }

        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveKeyFromPasscode(candidateKey, salt, ['encrypt']);
        const encrypted = await encryptWithKey(memoText, key);
        const payload = {
          ...encrypted,
          salt: bufferToBase64(salt),
          kdf: { name: 'PBKDF2', iterations: KDF_ITERATIONS, hash: 'SHA-256' },
        };

        const response = await fetch(`${API_BASE}/${encodeURIComponent(candidateId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.status === 409) {
          candidateId = generateCustomId(idLength, { useNum, useLow, useUp });
          candidateKey = generateKeyString(keyLength, { useNum, useLow, useUp });
          setGeneratedId(candidateId);
          setKeyString(candidateKey);
          continue;
        }
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          console.error('Share failed', {
            status: response.status,
            statusText: response.statusText,
            body,
          });
          throw new Error(`Connection failed (HTTP ${response.status})`);
        }

        setGeneratedId(candidateId);
        setKeyString(candidateKey);
        await copyToClipboard(buildShareLink(candidateId, candidateKey));
        setLastSharedId(candidateId);
        setShareStatus('active');
        setShareExpiresAt(Date.now() + TTL_MS);
        return;
      }

      throw new Error('Code collision! Please refresh (↻) to get a new code.');
    } catch (err: any) {
      console.error('Failed to seal', err);
    } finally {
      setIsSharing(false);
    }
  };

  const remainingMs =
    shareStatus === 'active' && shareExpiresAt ? Math.max(0, shareExpiresAt - now) : null;
  const remainingText = remainingMs !== null ? formatDuration(remainingMs) : null;
  const memoCharCount = useMemo(() => getCharCount(memoText), [memoText]);

  return (
    <div className={`min-h-screen ${themeClasses.pageBg} ${themeClasses.text}`}>
      <div className="mx-auto flex h-screen w-full max-w-3xl flex-col px-5 pb-10 pt-5">
        <header className="flex items-center justify-between py-2 font-ui">
          <div className={`text-lg font-semibold tracking-tight ${themeClasses.brand}`}>
            Memo Relay
          </div>
          <div className="flex items-center gap-3">
            <select
              id="theme-select"
              className={`rounded border border-black/10 bg-transparent px-2 py-1 text-sm ${themeClasses.text}`}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="classic">Classic Yellow</option>
              <option value="plain">Plain White</option>
              <option value="dark">Blueprint Dark</option>
            </select>
          </div>
        </header>

        <main id="app" className="flex min-h-0 flex-1 flex-col">
          <section
            id="view-write"
            className={`${view === 'write' ? 'flex' : 'hidden'} relative min-h-0 flex-1 flex-col gap-5`}
          >
            <div
              className={`rounded-xl border border-black/5 p-5 shadow-sm transition ${themeClasses.panelBg} ${themeClasses.panelText}`}
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <label>Share Link (Link ID)</label>
                <div className="flex items-center gap-3">
                  <button
                    id="btn-save"
                    className={`inline-flex items-center justify-center transition ${themeClasses.accent} disabled:opacity-40`}
                    title="Save"
                    onClick={handleSave}
                    disabled={!isDirty}
                  >
                    <Save size={18} />
                  </button>
                  <button
                    id="btn-share"
                    className={`inline-flex items-center justify-center transition ${themeClasses.accent} disabled:opacity-40`}
                    title="Share"
                    onClick={handleShare}
                    disabled={isSharing || shareStatus === 'active'}
                  >
                    <Share2 size={18} />
                  </button>
                  <button
                    id="btn-refresh"
                    className={`inline-flex items-center justify-center transition ${themeClasses.accent} hover:rotate-180`}
                    title="Regenerate"
                    onClick={handleRefresh}
                  >
                    <RefreshCcw size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-lg border border-black/10 bg-black/5 px-4 py-2">
                <input
                  type="text"
                  id="id-input"
                  className={`flex-1 bg-transparent font-mono text-sm tracking-wide outline-none ${themeClasses.text}`}
                  spellCheck={false}
                  value={shareLink}
                  readOnly
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-ui text-neutral-500">
                <span>Status:</span>
                {lastSharedId ? (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase ${statusPillClass}`}>
                    {shareStatus}
                  </span>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase ${themeClasses.statusIdle}`}>
                    Not shared
                  </span>
                )}
                <span className="text-neutral-400">•</span>
                {shareStatus === 'active' && remainingText ? (
                  <span>Expires in {remainingText}</span>
                ) : (
                  <span>TTL: {TTL_MINUTES} min</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-20 text-sm text-neutral-500">
                    Length: <span className={themeClasses.accent}>{idLength}</span>
                  </span>
                  <input
                    type="range"
                    id="opt-len"
                    min={KEY_MIN_LEN}
                    max={KEY_MAX_LEN}
                    value={idLength}
                    className={`w-32 ${themeClasses.accentInput}`}
                    onChange={(e) =>
                      setIdLength(clamp(Number(e.target.value), KEY_MIN_LEN, KEY_MAX_LEN))
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 text-sm text-neutral-500">
                    Key: <span className={themeClasses.accent}>{keyLength}</span>
                  </span>
                  <input
                    type="range"
                    id="opt-key-len"
                    min={KEY_MIN_LEN}
                    max={KEY_MAX_LEN}
                    value={keyLength}
                    className={`w-32 ${themeClasses.accentInput}`}
                    onChange={(e) =>
                      setKeyLength(clamp(Number(e.target.value), KEY_MIN_LEN, KEY_MAX_LEN))
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      id="opt-num"
                      checked={useNum}
                      onChange={(e) => handleOptionToggle('useNum', e.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${useNum
                          ? `${themeClasses.accentBg} text-white border-transparent`
                          : 'border-black/10 text-neutral-500'
                        }`}
                    >
                      123
                    </span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      id="opt-low"
                      checked={useLow}
                      onChange={(e) => handleOptionToggle('useLow', e.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${useLow
                          ? `${themeClasses.accentBg} text-white border-transparent`
                          : 'border-black/10 text-neutral-500'
                        }`}
                    >
                      abc
                    </span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      id="opt-up"
                      checked={useUp}
                      onChange={(e) => handleOptionToggle('useUp', e.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${useUp
                          ? `${themeClasses.accentBg} text-white border-transparent`
                          : 'border-black/10 text-neutral-500'
                        }`}
                    >
                      ABC
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div
              className={`relative max-h-[calc(100vh-260px)] overflow-hidden rounded-sm border border-black/5 shadow-lg ${themeClasses.paperBg} ${themeClasses.line} bg-[length:100%_2.4rem] bg-local ${themeClasses.marginLine} before:absolute before:inset-y-0 before:left-12 before:w-px before:content-['']`}
            >
              <textarea
                id="memo-input"
                className={`w-full min-h-56 max-h-[calc(100vh-260px)] resize-none bg-transparent px-8 py-2 pl-16 font-body text-lg leading-10 outline-none ${themeClasses.text}`}
                placeholder="Start writing..."
                spellCheck={false}
                value={memoText}
                ref={textareaRef}
                onChange={(e) => {
                  const nextValue = clampTextByChars(e.target.value, MEMO_MAX_CHARS);
                  setMemoText(nextValue);
                  setIsDirty(nextValue !== lastSavedRef.current);
                }}
              />
            </div>
            <div className="flex justify-end text-xs font-ui text-neutral-500">
              {memoCharCount}/{MEMO_MAX_CHARS} chars
            </div>

          </section>

          <section
            id="view-read"
            className={`${view === 'read' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col gap-4`}
          >
            <div
              className={`relative max-h-[calc(100vh-260px)] overflow-hidden rounded-sm border border-black/5 shadow-lg ${themeClasses.paperBg} ${themeClasses.line} bg-[length:100%_2.4rem] bg-local ${themeClasses.marginLine} before:absolute before:inset-y-0 before:left-12 before:w-px before:content-['']`}
            >
              {!readError && readContent && (
                <div
                  id="read-content"
                  className={`w-full min-h-56 max-h-[calc(100vh-260px)] whitespace-pre-wrap bg-transparent px-8 py-2 pl-16 font-body text-lg leading-10 ${themeClasses.text}`}
                >
                  {readContent}
                </div>
              )}
              {!readError && !readContent && (
                <div
                  id="read-placeholder"
                  className="flex min-h-56 items-center justify-center px-8 py-2 text-center text-sm italic text-neutral-400"
                >
                  <p>{readPlaceholder}</p>
                </div>
              )}
              {readError && (
                <div
                  id="read-error"
                  className="flex min-h-56 flex-col items-center justify-center gap-2 px-8 py-2 text-center text-sm text-orange-400"
                >
                  <h3 className="text-base font-semibold">Unavailable</h3>
                  <p>This page has been torn out.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pr-8 pb-6">
              <button
                id="btn-new"
                className={`rounded border border-black/10 px-4 py-2 text-sm font-ui ${themeClasses.text}`}
                onClick={() => (window.location.href = '/')}
              >
                Write New Memo
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

async function copyToClipboard(text: string) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const temp = document.createElement('textarea');
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      temp.remove();
    }
    return true;
  } catch {
    return false;
  }
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function checkApiHealth() {
  try {
    const res = await fetch('/api/health', { method: 'HEAD' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

async function burnMemo(id: string) {
  if (!id) return;
  try {
    await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
  } catch {
    // best-effort burn
  }
}
