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

  return { id, key };
}
