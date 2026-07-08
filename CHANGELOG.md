# Changelog

## [1.13.2] - 2026-06-29
### Fixed
- **i18n: replace hardcoded `alert()` calls with localized custom modal (closes #13)**
  - Replaced 2 native `alert()` calls in `src/components/MapContainer.tsx` (polygon draw and edit over-area checks) with a custom `AlertModal` component.
  - `AlertModal` features glassmorphism design consistent with the project, smooth open/close animations (`open:animate-in fade-in zoom-in-95`), and full ARIA accessibility (`role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`).
  - Added i18n keys under the `map` namespace in all 3 locale files (`en-US.json`, `pt-BR.json`, `es-ES.json`): `map.areaLimitTitle`, `map.polygonTooLarge` (with `{{areaKm2}}` and `{{maxArea}}` interpolation), `map.polygonEditedTooLarge`.
  - State for modal open/message is hoisted to component level (above Leaflet event scope) so it correctly triggers React re-renders.
  - No hardcoded strings remain in the polygon area validation code paths.
### Added
- **`src/components/AlertModal.tsx`** — reusable modal component with props `isOpen`, `message`, `onClose`, `title?`.
- **`src/components/AlertModal.test.tsx`** — 8 Vitest unit tests (jsdom environment) covering: render when open, hidden when closed, X-button close, OK-button close, Escape key (dialog `close` event), message content, accessibility attributes, optional title.
- `jsdom` and `@testing-library/jest-dom` added as dev dependencies.
- `vite.config.ts` extended with Vitest workspace projects: `unit` (Node, `tests/**/*.test.ts`) and `components` (jsdom, `src/**/*.test.tsx`) — all 67 tests pass.

## [1.13.0] - 2026-06-29
### Added
- **Vitest unit test suite** — comprehensive test coverage for all core algorithmic and utility modules:
  - `tests/optimizer.test.ts` (39 tests): Full assertion-driven coverage of the MCPP pipeline —
    `CustomMultiGraph` data structure, `extractLargestSCC` (Tarjan's algorithm), `isPointInPolygon`
    (ray-casting), `buildBaseData` (OSM parsing), `hierholzer` (Eulerian circuit extraction) and
    `solveMCPPAndBuildEulerianGraph` (LP/heuristic MCPP solver). Includes two fixture-driven
    integration tests that validate the closed-circuit invariant on real OSM data.
    Every complex algorithm suite includes explanatory comments describing what the algorithm does,
    why it is needed, and what invariant the test verifies.
  - `tests/gpxExport.test.ts` (10 tests): Validates `buildGpxContent` XML structure, coordinate
    embedding, default/custom route names, and edge cases (empty path, single point).
  - `tests/routeSharing.test.ts` (10 tests): Enhanced coverage for encode/decode round-trips —
    URL-safety, single-point paths, legacy uncompressed polyline URLs, 200-point large path
    round-trip, and compression ratio assertion.
- Vitest `test` block added to `vite.config.ts` (Node environment, `globals: true`, `include` pattern).

## [1.12.4] - 2026-06-29
### Fixed
- **Proxy hotfix**: regressão introduzida em v1.12.3 causava `406 Not Acceptable` ao chamar `overpass-api.de`.
  - Header `Accept` revertido de `application/json` para `*/*` — o firewall anti-bot da FOSSGIS rejeita valores específicos de `Accept`.
  - HTTP `406` adicionado ao `shouldFallback()`, garantindo que o proxy tente o próximo endpoint em vez de devolver o erro ao cliente.

## [1.12.3] - 2026-06-29
### Changed
- **Proxy (`proxy/src/index.ts`)**: Lista de endpoints atualizada com base nas instâncias públicas oficiais do Overpass API:
  - Adicionado `maps.mail.ru/osm/tools/overpass` (VK Maps — sem rate limit declarado).
  - `overpass.kumi.systems` substituído pelo novo endereço `overpass.private.coffee`.
  - Erros HTTP **429 (Too Many Requests)** agora acionam fallback para o próximo endpoint em vez de retornar imediatamente ao cliente.
  - Adicionado header `Referer` em conformidade com a política de uso da OSM/FOSSGIS.
- **API client (`src/api/overpass.ts`)**:
  - Unificados todos os caminhos de fetch em um único helper `queryOverpass()` com `AbortController`, timeout de 60 s e form-encoding `data=` consistente.
  - Mensagens de erro específicas para timeout e rate-limit (429).
  - Exportado tipo `OverpassResponse` para tipagem correta dos consumidores.
  - Separada a construção das queries em `buildRoadQuery()` para melhor legibilidade.

## [1.12.2] - 2026-06-29
### Refactored
- Extraídos todos os SVGs inline que não são ícones React para arquivos dedicados em `public/icons/`:
  - `gps-locate.svg` — ícone do botão GPS/Localização no mapa (Leaflet custom control)
  - `magic-wand.svg` — ícone do seletor de bairros (Leaflet custom control)
  - `draw-polygon.svg`, `edit-nodes.svg`, `delete-polygon.svg` — ícones personalizados da toolbar do Leaflet Draw
- `MapContainer.tsx`: strings `.innerHTML` com SVG substituídas por tags `<img src="/icons/...">`.
- `style.css`: data-URIs `background-image: url('data:image/svg+xml;...')` substituídas por `url('/icons/...')`, reduzindo o tamanho do CSS compilado.

## [1.12.1] - 2026-06-29
### Refactored
- Extração da lógica de exportação GPX do `Planner.tsx` e `Preview.tsx` para uma função utilitária pura (`src/utils/gpxExport.ts` — `buildGpxContent` / `downloadGpx`) e um componente React auto-contido (`ExportGpxButton`).
- A prop `onExportGpx` foi removida da interface pública do `Sidebar`, que agora renderiza o `ExportGpxButton` diretamente recebendo apenas os dados do percurso.

## [1.12.0] - 2026-06-28
### Added
- Refatoração das chamadas de rede (Fetch API) para a proxy do Overpass utilizando `@tanstack/react-query`.
- Criação de um módulo externo de API (`src/api/overpass.ts`) para centralizar lógicas de rede, removendo dependência de rede de dentro dos web workers para focar o processamento exclusivamente na CPU.

## [1.11.1] - 2026-06-28
### Fixed
- Correção de localização (i18n) pendente nos botões internos de desenho do mapa (Leaflet Draw) e nos textos do loader global (Busca de Bairros).
- Adição de testes de regressão visual para o estado de desenho (Drawing In Progress).

## [1.11.0] - 2026-06-28
### Added
- Localização completa do aplicativo para Português (`pt-BR`), Inglês (`en-US`) e Espanhol (`es-ES`) utilizando a biblioteca `react-i18next`.
- Componente seletor de idiomas (`LanguageSelector`) adicionado no cabeçalho (`TopNav`) para troca instantânea de idioma.
- Detecção automática de idioma baseada no navegador do usuário.

## [1.10.8] - 2026-06-28
### Added
- Introdução de testes E2E Mobile com suporte a Safari (WebKit) via Playwright.
- Implementação de testes de regressão visual (Visual Regression Tests) focados nos estados críticos da interface de usuário, com a área do mapa mascarada para evitar falsos positivos gerados pelo carregamento assíncrono dos tiles.
- Adição dos scripts `test:e2e:visual` e `test:e2e:visual:update` no `package.json`.

## [1.10.7] - 2026-06-28
### Fixed
- Correção de um espaçamento (gap) extra de 12px que aparecia no layout mobile entre as ferramentas de desenho e a "Magic Wand" quando o polígono ainda não havia sido desenhado, causado por elementos de UI invisíveis do Leaflet Draw.

## [1.10.6] - 2026-06-28
### Fixed
- Ajuste no layout mobile para alinhar o botão de configurações (`Settings`) verticalmente abaixo do ícone de esporte, acompanhando o fluxo do menu de desenho.

## [1.10.4] - 2026-06-28
### Changed
- O selector de esporte na visualização mobile agora exibe ícones SVG dedicados (pessoa caminhando / bicicleta) em vez de texto, melhorando a experiência de usuário e ocupando menos espaço na tela.

## [1.10.3] - 2026-06-28
### Fixed
- Selector de esporte (Ciclismo/Caminhada) e botão de configurações movidos da barra de navegação principal (`TopNav`) para flutuar diretamente sobre o mapa (`Toolbar`) na visualização mobile, garantindo uma interface mais limpa.

## [1.10.2] - 2026-06-28
### Fixed
- Correção no layout mobile onde o ícone da "Magic Wand" se sobrepunha ao menu de ferramentas de desenho do polígono (agora renderizam em coluna).

## [1.10.1] - 2026-06-28
### Added
- Criação de uma biblioteca de componentes de UI (`src/components/ui/Button.tsx`).
- Criação de uma biblioteca de ícones centralizada (`src/components/icons/index.tsx`).

### Changed
- Refatoração de todos os botões e SVGs inline da aplicação para utilizar os novos componentes padronizados, melhorando consistência visual e manutenibilidade.

## [1.8.0] - 2026-06-28
- Migração completa da arquitetura vanilla TypeScript para React (v19).
- Centralização do estado global utilizando `zustand`.
- Modularização da interface (anteriormente no `index.html`) em diversos componentes isolados (e.g., `MapContainer`, `Sidebar`, `Toolbar`), melhorando a manutenibilidade e escalabilidade do código.
- Testes end-to-end do Playwright ajustados para suportar o ciclo de vida dos componentes React.
## [1.7.0] - 2026-06-28
### Added
- Configuração de testes E2E utilizando o Playwright (`@playwright/test`).
- Testes end-to-end (E2E) para garantir a integridade dos fluxos de criação e compartilhamento de rotas (caminhada e ciclismo) de forma automatizada.

### Fixed
- A modalidade de esporte escolhida (`mode`) e a distância agora são corretamente persistidas nas URLs compartilhadas mesmo quando o usuário desenha o polígono manualmente.

## [1.5.0] - 2026-06-27
### Added
- Novas opções de personalização de rotas com botão "Settings" na interface:
  - **Polygon Expansion (Slider):** O usuário agora pode escolher uma distância (de 0m a 100m) para extrapolar o polígono ao buscar ruas.
  - **Cycling Preference:** Opção para ciclistas escolherem o tipo de vias ("Qualquer rua", "Mais segura", "Apenas ciclovias estritas").
### Changed
- Otimização das consultas de `Overpass API` no worker, permitindo refinar a busca baseada na preferência de ciclofaixas selecionada pelo usuário.
## [1.4.18] - 2026-06-27
### Fixed
- Corrigido problema onde o Global Loader não desaparecia após carregar os bairros salvos na memória cache.

## [1.4.17] - 2026-06-27
### Added
- Implementado um "Global Loader" em tela cheia que bloqueia interações do usuário enquanto rotas são calculadas ou bairros são buscados.
- Cache inteligente no lado do cliente (Cache API do navegador) para chamadas do mapa de bairros, acelerando radicalmente consultas repetidas à mesma área geográfica.

### Changed
- Estilo dos botões desabilitados foi aprimorado para exibir visualmente o estado de bloqueio (`cursor-not-allowed`).

## [1.4.16] - 2026-06-27
### Fixed
- Algoritmo aprimorado para não excluir ruas que ficam nas bordas ou limites do polígono desenhado. Foi adicionada uma "gordura" (buffer de ~22m) que garante que a via não seja ignorada se qualquer extremidade ou o centro dela estiver rente ou tangenciando o limite da marcação.

## [1.4.15] - 2026-06-27
### Changed
- Adicionada tag "Beta" e link para o repositório do GitHub no modal "About".

## [1.4.14] - 2026-06-27
### Fixed
- Corrigido algoritmo de geração de rotas (MCPP) no modo "Walking" para bairros onde as fronteiras cortam ruas e geram redes desconexas, garantindo que o trajeto resultante seja integralmente conectado e cubra todas as vias necessárias.

## v1.4.13
- **Proxy Resilience**: Added fallback logic to the Cloudflare Worker proxy (`rotas-overpass-proxy`) to automatically switch between multiple public Overpass API endpoints (`overpass-api.de`, `lz4.overpass-api.de`, `z.overpass-api.de`, `overpass.kumi.systems`) when encountering `504 Gateway Timeout` or other `5xx` errors.

## v1.4.12
- **About Modal**: Added an "About" button to the navbar (with a dedicated icon for mobile) that opens a centered modal dialog. The modal displays information about the project ("Rotas") and credits the author (Icaro MH).

## v1.4.11
- **Navbar Fix**: Updated the "Planner" link in the navigation bar to correctly redirect to the home page (`/`) instead of using a dead hash link (`#`).

## v1.4.10
- **Consistent Sport Tag Visibility**: Ensured that the sport tag ("Ride" or "Walk") is always displayed in the "Done" view and shared route view, even for custom drawn polygons that don't have a neighborhood name. In these cases, it defaults to displaying "Custom Route".

## v1.4.9
- **Title Update**: Updated the application `<title>` in `index.html` to "Rotas - Explore Every Inch" for better alignment with the internal branding.

## v1.4.8
- **UI Cleanup**: Fully removed the legacy speed input elements from the HTML interface, as the application now relies completely on fixed speed constants.

## v1.4.7
- **Build CSS Fix**: Corrected the CSS import order in `main.ts` — `style.css` is now imported after `leaflet.css` and `leaflet-draw.css`, ensuring custom overrides (like `.leaflet-draw-toolbar { margin-top: 0 }`) always win in the production bundle.

## v1.4.6
- **Shared View Layout Fix**: Fixed the Preview and GPX buttons alignment in shared view so that they sit side-by-side on the same row.
- **Shared View Estimated Time**: Render the estimated time dynamically in the shared view by calculating it from the shared distance and mode parameters using fixed constants.

## v1.4.5
- **Shared View UI Overhaul**: The sidebar in shared route view now shows the "Explore Every Inch" header at all times. Action buttons (Preview, GPX) are pinned to the bottom of the sidebar as a fixed footer alongside the "Viewing an external route" notice. In shared view, Preview and GPX appear side-by-side in a single row. The sidebar now has fully rounded corners on desktop via `overflow-hidden` clipping child elements. **New Plan** in shared view redirects to `/` to start fresh, instead of producing a broken in-place reset with stale UI.
- **Speed/Pace Input Removed**: The speed and pace inputs have been replaced with fixed constants (`SPEED_BIKE = 17 km/h`, `PACE_WALK = 10 min/km`), simplifying the UI.

## v1.10.1
- **TypeScript Configuration**: Enabled `"strict": true` (which includes `"strictNullChecks"`) in `tsconfig.json` to satisfy TanStack Router's requirement for correct route parameter and search type inference, resolving the compiler error in `src/router.tsx`.

## v1.10.0
- **Zustand State Refactor**: Heavily cleaned up the global `useAppStore` by stripping out volatile routing and session data (`isSharedView`, `isDoneMode`, `currentPathData`).
- **Strict Component Segregation**: Shifted the stripped state down to local component state within `Planner.tsx` and `Preview.tsx`, and passed them via standard React props to child components (`Sidebar.tsx`, `MapContainer.tsx`, `TopNav.tsx`, `Toolbar.tsx`). This resolves global state leakage across routes and enables automatic garbage-collection when navigating.

## v1.9.0
- **E2E Testing Stabilization**: Fixed flaky E2E tests caused by React component unmounts interrupting the Web Worker execution.
- **Robust Route Parsing**: Adjusted TanStack Router Zod schemas (`z.coerce.string()`) to properly handle numbers from query params like distance to fix validation errors preventing the shared view from rendering.
- **URL Encoding Fix**: Added a safety net to strictly `decodeURIComponent` on route decoding, preventing issues with browsers or clipboards accidentally double-encoding the URI string.

## v1.8.0
- **Router Migration**: Refactored the single-page monolithic application into a multi-route architecture powered by `@tanstack/react-router`.
- **View Split**: Decoupled the creation workflow (`/`) from the route preview mode (`/preview`) to drastically reduce component complexity and heavy rendering logic when loading shared links.
- **Enhanced Type Safety**: Added Zod schema validation directly into the router for strict URL query parameter parsing and safety.

## v1.4.4
- **Accurate Shared Route Distance**: Fixed a regression where shared URLs displayed approximately double the real distance. The root cause was recalculating distance from node-to-node straight lines (losing intermediate street geometry). The original distance computed by the worker is now embedded in the shared URL (`?distance=...`) and used directly, with a fallback to point-to-point calculation for legacy links.

## v1.4.3
- **Shared Route Fixes**: Fixed a bug where URL parameters losing their `+` encoding (converted to spaces) caused LZString decompression to fail, resulting in corrupted path generation. Additionally, ensured that the mobile navigation button accurately displays "New Plan" instead of "Plan Route" when viewing shared routes.

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
