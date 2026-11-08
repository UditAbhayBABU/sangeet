import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 768) {
  const detectMobile = () => {
    if (typeof window === 'undefined') return true;
    const forced = window.sessionStorage?.getItem('sangeet_preview_mobile_mode');
    if (forced === 'false') return false; // Explicit desktop request
    if (forced === 'true') return true;

    // By default, open in Mobile View on all devices (including desktop)
    return true;
  };

  const [isMobile, setIsMobile] = useState<boolean>(detectMobile);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(detectMobile());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [breakpoint]);

  const toggleMobilePreview = () => {
    setIsMobile((prev) => {
      const next = !prev;
      window.sessionStorage?.setItem('sangeet_preview_mobile_mode', String(next));
      return next;
    });
  };

  return { isMobile, toggleMobilePreview };
}
