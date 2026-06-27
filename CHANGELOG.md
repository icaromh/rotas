# Changelog

## v1.4.2
- **Robust Legacy Link Support**: Added a precise Regex fallback `(/[?@\\{}_^~`]/`) in the routing decoder to safely handle uncompressed URL formats generated before v1.4.1. This prevents the LZ-String algorithm from attempting to decompress incompatible URI strings which previously led to massively corrupted Eulerian paths mapping (e.g., 43km mutating into 98km).
- **Cleaner Shared View**: Refined the "Shared Route" notification box by removing the redundant neighborhood title, and correctly hiding the top navigation's sport-selector when previewing external links to keep the interface purely focused on the map.

## v1.4.1
- **Deep URL Compression**: Implemented `lz-string` algorithm on top of the polyline encoder to aggressively compress shared route URLs, definitively solving the `HTTP 431 Request Header Fields Too Large` crash when users try to generate and share links for massive city-scale neighborhoods like *Sant Pere*. Old uncompressed URLs continue to be gracefully supported.

## v1.4.0
- **Magic Wand: Neighborhood Picker 🪄**: Added a new custom map tool that dynamically fetches OpenStreetMap administrative boundaries (`admin_level=9|10` or `place=neighbourhood`) within the current viewport.
- **GeoJSON Processing**: Integrated `osmtogeojson` to accurately convert raw OSM JSON relations into interactive MultiPolygons directly on the map.
- **Dynamic Contextual UI**: Selected neighborhoods now automatically populate the bottom sheet/sidebar with their actual names (e.g., "Eixample").
- **Smart Share Links**: Natively shares the route with personalized contextual text (e.g., "Ride through Gràcia") and embeds the neighborhood name into the URL (`?name=...`) for a fully immersive "Guest View" experience.
- **UI/UX Refinements**: Shortened the "Preview Route" action button to "Preview" to prevent text overflow in shared split-layouts, and ensured creation settings (like speed config) are 100% hidden on desktop when viewing external shared links.
- **Hover Tooltips**: Implemented sleek, dark-themed pill tooltips (`sticky: true`) that follow the user's cursor when hovering over neighborhoods, displaying the area's name.
- **Rounded Edit Handles**: Overrode Leaflet Draw's default square vertex handles with fully rounded circular nodes to match the modern styling of the application.
- **Done Mode & UI Reset**: After successfully generating a route, the interface elegantly enters a "Done" state: all draw and setup controls disappear to maximize map visibility, and the action button transforms into a "New Plan" button. Clicking "New Plan" instantly resets all states, clears the map, and brings back the creative tools.
- **Mathematical Solver Robustness**: Refactored the core Tarjan's Strongly Connected Components algorithm inside the Web Worker from a recursive approach to an iterative call-stack. This definitively prevents the notorious "Maximum call stack size exceeded" crash on massive neighborhoods.
- **Heuristic MCPP Fallback (OOM Prevention)**: Introduced a custom Greedy Shortest-Path Heuristic solver (using Dijkstra's) that automatically activates when graphs exceed 1.000 edges. This bypasses the LP Solver's dense matrix builder, entirely preventing the "Array buffer allocation failed" (Out of Memory) crashes when analyzing gigantic areas.
- **Sport Type Tag & URL State**: The selected sport type (Ride or Walk) is now encoded into the shared URL (`?mode=...`) and beautifully displayed as an uppercase colored badge right next to the neighborhood's name in the results title.
- **Mobile UI Polish**: Fixed an issue where the mobile sport selector dropdown remained visibly duplicated in the top navigation during Done/Preview mode.

## v1.3
- **Komoot-Inspired Premium Redesign**: Complete visual overhaul of the UI/UX focusing on responsiveness, aesthetics, and clarity.
  - **Floating Map Controls**: Moved native Leaflet zoom, GPS, and draw controls to isolated top corners, maximizing map real estate.
  - **Custom Semantic SVG Icons**: Replaced default Leaflet Draw sprites with custom inline SVGs. Adopted 'Nodes and Outlines' standard for Drawing and an 'Arrow Cursor' for Editing nodes.
  - **Mobile Bottom Sheet**: Transformed the classic desktop sidebar into a swipeable, elegant iOS/Android style Bottom Sheet for mobile users.
  - **Ultra-Compact Mobile Results**: Rebuilt the results panel on mobile to use an ultra-compact, two-column layout (`Distance` and `Est. time`) with dynamic styled units, hiding unnecessary setup controls (e.g. speed inputs) after generation.
  - **Refined Selectors**: Replaced bulky sport dropdown icons with sleek right-aligned carets. Mirrored the sport selector to the mobile top Navbar for immediate access.
  - **Bug Fix**: Fixed a critical issue where the mobile "Plan Route" button would fail to restore its original HTML/loading state after the Web Worker response.

## v1.2
- **Route Sharing via URL (#1)**: Users can now share optimized routes natively.
  - Implemented `@mapbox/polyline` to aggressively compress GPS paths into URL-safe strings.
  - Added a "Compartilhar" (Share) button leveraging the native `Web Share API` (with fallback to clipboard).
  - Designed an isolated "Guest View": loading a route via the `?route=` parameter automatically hides creation tools and displays only essential playback and export options.
  - Added unit tests for decoding/encoding paths to ensure complete geographic fidelity.

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
