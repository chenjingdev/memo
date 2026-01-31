export function buildShareLink(id: string, key: string) {
  if (!id || !key) return '';
  if (typeof window === 'undefined') return `/${id}#${key}`;
  return `${window.location.origin}/${id}#${key}`;
}

export function parseRoute() {
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

  if (!id && key && typeof document !== 'undefined' && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin) {
        const refMatch = ref.pathname.match(/^\/([A-Za-z0-9]+)$/);
        if (refMatch) id = refMatch[1];
      }
    } catch {
      // ignore referrer parse failures
    }
  }

  if (!id && key && typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem('memo-last-route');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.key === key && typeof data.id === 'string') {
          id = data.id;
        }
      }
    } catch {
      // ignore storage parse failures
    }
  }

  if (id && key && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem('memo-last-route', JSON.stringify({ id, key }));
    } catch {
      // ignore storage write failures
    }
  }

  return { id, key };
}
