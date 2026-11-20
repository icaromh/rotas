import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useRouterState } from '@tanstack/react-router';

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY?.trim();
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com';

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-01-30',
    capture_exceptions: true,
    debug: false,
    opt_out_capturing_by_default: import.meta.env.DEV,
  });
}

function PageViewTracker() {
  const location = useRouterState({ select: (s) => s.location });

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    posthog.capture('$pageview', { $current_url: window.location.href });
  }, [location.pathname, location.search]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PageViewTracker />
      {children}
    </PHProvider>
  );
}
