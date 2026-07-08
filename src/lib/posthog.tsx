import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useRouterState } from '@tanstack/react-router';

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: '/ingest',
  ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
  defaults: '2026-01-30',
  capture_exceptions: true,
  debug: import.meta.env.DEV,
});

function PageViewTracker() {
  const location = useRouterState({ select: (s) => s.location });

  useEffect(() => {
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
