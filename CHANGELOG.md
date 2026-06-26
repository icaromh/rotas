# Changelog

## v1.1
- **API Resilience (CORS bypass)**: Solved CORS errors from the public Overpass API by implementing an edge Cloudflare Worker proxy (`rotas-overpass-proxy.icaro-mh.workers.dev`). This ensures the app can reliably fetch OpenStreetMap data even if the upstream API throws errors that normally strip CORS headers.
- **Proxy Security Rules**: Configured the Cloudflare proxy to strictly block external requests, only allowing traffic originating from the production domain (`rotas-dusky.vercel.app`) and local development environments. 
- **OSM Compliance**: Implemented dynamic `User-Agent` and `Accept` header injection within the proxy to bypass `406 Not Acceptable` firewall rejections from OpenStreetMap's anti-bot protections.
- **Worker Fallbacks**: Migrated the PWA's web worker architecture to route all heavy map data requests exclusively through the new edge proxy, with aggressive `AbortController` timeouts to prevent hanging requests.

## v1
- **Performance Optimization**: Solved the massive latency (hanging for +5 min) in the LP Solver step by refactoring the Mixed Chinese Postman Problem to drop integer constraints, leveraging total unimodularity. Execution of polygons with 4000+ edges dropped from 5+ minutes to < 1 second.
- **Testing Infrastructure**: Added `vitest` for running local automated tests without the browser.
- **Test Fixtures**: Implemented a way to dump the scene geometry (`polygon`, `mode`, `overpassData`) to a `.json` fixture to reproduce bugs in unit tests.
- **UX Improvements**: Exposes `downloadFixture()` on the window object to cleanly download debug scenes without cluttering the UI.
- **Bug Fix**: Addressed a typo where the distance metric for calculating final kilometers returned NaN by explicitly passing the `distance` property down to the Eulerian Graph edge attributes.
