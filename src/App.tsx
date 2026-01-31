import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import MemoEditor from './components/MemoEditor';
import MemoViewer from './components/MemoViewer';
import SharePanel from './components/SharePanel';
import {
  API_BASE,
  ID_RE,
  KDF_ITERATIONS,
  KEY_MAX_LEN,
  KEY_MIN_LEN,
  MEMO_MAX_CHARS,
  TTL_MS,
} from './lib/constants';
import {
  clamp,
  generateCustomId,
  generateKeyString,
  normalizeOptions,
  type IdOptions,
} from './lib/id';
import { buildShareLink, parseRoute } from './lib/route';
import { readBool, readNumber, readString } from './lib/storage';
import { clampTextByChars, getCharCount } from './lib/text';
import { bufferToBase64, decryptPayload, deriveKeyFromPasscode, encryptWithKey } from './lib/crypto';
import { useShareStatus } from './hooks/useShareStatus';
import type { ThemeClasses } from './types';

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
  const { shareStatus, setShareStatus, shareExpiresAt, setShareExpiresAt, now } =
    useShareStatus(lastSharedId);

  const lastRouteRef = useRef<string | null>(null);
  const lastSavedRef = useRef('');

  const themeClasses: ThemeClasses = useMemo(() => {
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

  const handleSave = useCallback(() => {
    const clipped = clampTextByChars(memoText, MEMO_MAX_CHARS);
    window.localStorage.setItem('memo-draft', clipped);
    lastSavedRef.current = clipped;
    setIsDirty(false);
  }, [memoText]);

  useEffect(() => {
    if (view !== 'write') return;
    const handle = window.setInterval(() => {
      if (!isDirty) return;
      handleSave();
    }, 30000);
    return () => window.clearInterval(handle);
  }, [handleSave, isDirty, view]);

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

  useEffect(() => {
    if (shareStatus !== 'expired') return;
    const nextId = generateCustomId(idLength, { useNum, useLow, useUp });
    const nextKey = generateKeyString(keyLength, { useNum, useLow, useUp });
    setGeneratedId(nextId);
    setKeyString(nextKey);
    setLastSharedId(null);
    setShareExpiresAt(null);
    setShareStatus('idle');
  }, [
    shareStatus,
    idLength,
    keyLength,
    useNum,
    useLow,
    useUp,
    setShareExpiresAt,
    setShareStatus,
  ]);

  return (
    <div className={`min-h-screen ${themeClasses.pageBg} ${themeClasses.text}`}>
      <div className="mx-auto flex h-screen w-full max-w-3xl flex-col px-5 pb-10 pt-5">
        <Header theme={theme} onThemeChange={setTheme} themeClasses={themeClasses} />

        <main id="app" className="flex min-h-0 flex-1 flex-col">
          <section
            id="view-write"
            className={`${view === 'write' ? 'flex' : 'hidden'} relative min-h-0 flex-1 flex-col gap-5`}
          >
            <SharePanel
              themeClasses={themeClasses}
              shareLink={shareLink}
              isDirty={isDirty}
              isSharing={isSharing}
              shareStatus={shareStatus}
              lastSharedId={lastSharedId}
              remainingText={remainingText}
              idLength={idLength}
              keyLength={keyLength}
              options={{ useNum, useLow, useUp }}
              onSave={handleSave}
              onShare={handleShare}
              onRefresh={handleRefresh}
              onIdLengthChange={(value) =>
                setIdLength(clamp(value, KEY_MIN_LEN, KEY_MAX_LEN))
              }
              onKeyLengthChange={(value) =>
                setKeyLength(clamp(value, KEY_MIN_LEN, KEY_MAX_LEN))
              }
              onOptionToggle={handleOptionToggle}
            />

            <MemoEditor
              themeClasses={themeClasses}
              memoText={memoText}
              setMemoText={setMemoText}
              setIsDirty={setIsDirty}
              lastSavedValue={lastSavedRef.current}
              view={view}
            />
          </section>

          {view === 'read' ? (
            <MemoViewer
              themeClasses={themeClasses}
              readContent={readContent}
              readError={readError}
              readPlaceholder={readPlaceholder}
              onWriteNew={() => (window.location.href = '/')}
            />
          ) : null}
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
