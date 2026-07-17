import { createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router';
import { PwaToast } from './components/PwaToast';
import { Planner } from './pages/Planner';
import { Preview } from './pages/Preview';
import { AuthCallback } from './pages/AuthCallback';
import { Changelog } from './pages/Changelog';
import { z } from 'zod';
import { PostHogProvider } from './lib/posthog';

const rootRoute = createRootRoute({
  component: () => {
    return (
      <PostHogProvider>
        <div className="flex flex-col h-screen w-screen bg-gray-50 text-gray-900 font-sans antialiased overflow-hidden">
          <Outlet />
          <PwaToast />
        </div>
      </PostHogProvider>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Planner,
});

const previewSearchSchema = z.object({
  route: z.string(),
  name: z.string().optional(),
  mode: z.enum(['bike', 'walk']).catch('bike'),
  distance: z.coerce.string().optional(),
});

export const previewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/preview',
  validateSearch: previewSearchSchema,
  component: Preview,
});

export const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallback,
});

export const changelogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/changelog',
  component: Changelog,
});

const routeTree = rootRoute.addChildren([indexRoute, previewRoute, authCallbackRoute, changelogRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
