import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

type Props = {
  className?: string;
  slot: string; // Your ad slot ID from AdSense
  format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle';
  responsive?: boolean;
};

export default function AdBanner({
  className = '',
  slot,
  format = 'auto',
  responsive = true,
}: Props) {
  const adRef = useRef<HTMLModElement>(null);
  const isAdLoaded = useRef(false);

  useEffect(() => {
    if (isAdLoaded.current) return;
    
    try {
      if (typeof window !== 'undefined' && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isAdLoaded.current = true;
      }
    } catch (e) {
      console.error('AdSense error:', e);
    }
  }, []);

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-2510187601795083"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
}
