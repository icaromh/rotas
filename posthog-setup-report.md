# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Rotas route planner app. PostHog was already partially set up with `posthog-js` installed and a basic provider in `src/lib/posthog.tsx`. The wizard updated the existing provider to use a reverse proxy (`/ingest`), enabled exception capture, and added the `defaults: '2026-01-30'` flag. Vite's dev server proxy was configured to route PostHog calls through `/ingest` to the EU region. Eight business-critical events were instrumented across seven files covering the full user journey: drawing an area, generating a route, sharing it, exporting GPX, and viewing a shared route.

| Event name | Description | File |
|---|---|---|
| `route_generated` | User successfully generates a route from the drawn polygon area. | `src/pages/Planner.tsx` |
| `route_generation_failed` | Route generation failed due to an algorithm or API error. | `src/pages/Planner.tsx` |
| `route_shared` | User shares a generated route via the share button. | `src/components/Sidebar.tsx` |
| `gpx_exported` | User exports the generated route as a GPX file. | `src/components/ExportGpxButton.tsx` |
| `route_preview_toggled` | User toggles the animated route preview on or off. | `src/components/Sidebar.tsx` |
| `sport_mode_changed` | User changes the sport mode between cycling and walking. | `src/components/Toolbar.tsx` |
| `preferences_saved` | User saves preferences including buffer size and safety level. | `src/components/PreferencesModal.tsx` |
| `shared_route_viewed` | A visitor views a shared route via a shared URL. | `src/pages/Preview.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/219004/dashboard/803050)
- [Routes generated over time](https://eu.posthog.com/project/219004/insights/bAlZ60bW)
- [Routes by sport mode](https://eu.posthog.com/project/219004/insights/pyfn5OHF)
- [Route generation success rate](https://eu.posthog.com/project/219004/insights/0HQQTJNM)
- [Route sharing and exports](https://eu.posthog.com/project/219004/insights/cHZ6A3Gd)
- [Generate → Share → View conversion funnel](https://eu.posthog.com/project/219004/insights/0UYO79OU)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite (`npm test`) — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
