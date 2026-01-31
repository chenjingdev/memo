import { useEffect, useState } from 'react';
import { API_BASE, POLL_INTERVAL_MS } from '../lib/constants';
import type { ShareStatus } from '../types';

export function useShareStatus(lastSharedId: string | null) {
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [shareExpiresAt, setShareExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

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

  return {
    shareStatus,
    setShareStatus,
    shareExpiresAt,
    setShareExpiresAt,
    now,
  };
}
