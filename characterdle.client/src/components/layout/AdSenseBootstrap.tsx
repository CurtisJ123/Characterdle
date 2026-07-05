import { useEffect } from 'react';

declare global {
  interface Window {
    __characterdleAdsenseLoaded?: boolean;
  }
}

const ADSENSE_SOURCE = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2618219034381751';

interface AdSenseBootstrapProps {
  isAdFreePremium: boolean;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isPremiumLoading: boolean;
}

function isLocalHost() {
  const { hostname, protocol } = window.location;

  return protocol === 'file:'
    || hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname.endsWith('.localhost');
}

function ensureAdSenseScriptLoaded() {
  if (window.__characterdleAdsenseLoaded) {
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-characterdle-adsense="true"]');

  if (existingScript) {
    window.__characterdleAdsenseLoaded = true;
    return;
  }

  const adSenseScript = document.createElement('script');
  adSenseScript.async = true;
  adSenseScript.src = ADSENSE_SOURCE;
  adSenseScript.crossOrigin = 'anonymous';
  adSenseScript.dataset.characterdleAdsense = 'true';
  document.head.appendChild(adSenseScript);
  window.__characterdleAdsenseLoaded = true;
}

export function AdSenseBootstrap({
  isAdFreePremium,
  isAuthenticated,
  isAuthLoading,
  isPremiumLoading,
}: AdSenseBootstrapProps) {
  useEffect(() => {
    if (typeof window === 'undefined' || isLocalHost() || isAuthLoading) {
      return;
    }

    if (isAuthenticated) {
      if (isPremiumLoading || isAdFreePremium) {
        return;
      }
    }

    ensureAdSenseScriptLoaded();
  }, [isAdFreePremium, isAuthenticated, isAuthLoading, isPremiumLoading]);

  return null;
}
