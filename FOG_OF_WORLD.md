# Implementation Plan: Fog of World Visualization

## Goal Description

The goal is to implement a "Fog of World" (or "Fog of War") rendering mode for the user's synchronized Strava activities. 
Currently, activities are rendered as opaque/semi-transparent colored lines on top of the map. In the new mode, the entire map will be covered in a dark overlay (the "fog"), and the areas the user has traversed will act as transparent "cutouts," revealing the underlying streets and map tiles.

## Proposed Approach

Instead of using computationally expensive vector boolean operations (like `turf.buffer` and `turf.difference`) on thousands of GPS paths, we will leverage **HTML5 Canvas Composite Operations** via a custom Leaflet Canvas Layer.

### 1. Canvas Overlay Renderer
We will create a custom Leaflet Layer (`L.Canvas` or a subclass of `L.Layer`) that sits on top of the map tiles.
- **Fill Phase:** On each render/zoom, fill the entire canvas with a semi-transparent dark color (e.g., `rgba(0, 0, 0, 0.75)`).
- **Composite Phase:** Set the canvas context `globalCompositeOperation = 'destination-out'`.
- **Draw Phase:** Iterate through the user's Strava GeoJSON LineStrings. Convert the lat/lng coordinates to pixel coordinates (`map.latLngToContainerPoint()`) and draw thick strokes (e.g., `lineWidth = 20`, `lineCap = 'round'`, `lineJoin = 'round'`).
- The `destination-out` operation will erase the dark overlay wherever a stroke is drawn, flawlessly revealing the map beneath without overlapping artifacts.

### 2. UI Controls & State
- Add a new "Fog Mode" toggle in the Strava User Menu (or Map Toolbar).
- When toggled, the application state (Zustand) will switch the rendering logic in `MapContainer.tsx` from the standard GeoJSON polyline renderer to the new Canvas Mask renderer.
- Provide a slider for "Fog Opacity" and "Reveal Width" (brush size) so users can customize the effect.

### 3. Performance Optimizations
- **Viewport Culling:** Only draw lines that intersect the current map bounds. Leaflet's `L.Renderer` does this natively, but if we write a custom canvas loop, we must ensure we cull off-screen paths to maintain 60 FPS on panning.
- **Debounced Redraw:** Redraw the canvas on `zoomend` and `moveend` instead of blocking the main thread continuously during fluid panning.

## Proposed Changes

### `src/components/MapContainer.tsx`
- [MODIFY] Integrate the `FogOverlayLayer` component. Conditionally render either the standard Polyline layer or the Fog layer based on the Zustand store.

### `src/components/FogOverlayLayer.tsx`
- [NEW] A React-Leaflet compatible component that wraps a custom `L.Layer`. It manages the Canvas DOM element, syncs dimensions with the map, hooks into the `moveend`/`zoomend` events, and executes the `destination-out` rendering loop over the GeoJSON features.

### `src/store/useAppStore.ts`
- [MODIFY] Add state: `isFogModeEnabled: boolean`, `fogOpacity: number`, `fogBrushSize: number`.

### `src/components/StravaUserMenu.tsx`
- [MODIFY] Add the UI toggles for activating Fog of World mode and adjusting the sliders.

## Open Questions

> [!IMPORTANT]  
> - **Default Styling:** What color should the fog be? Pure black (`#000000` with 80% opacity) or a dark blue/slate?
> - **Reveal Width:** Should the width of the revealed path represent a realistic physical dimension (e.g., exactly 20 meters wide based on zoom level), or just a fixed pixel width (e.g., 10px regardless of zoom)? Fixed pixel width is easier to see when zoomed out, while realistic physical width is more true to the "explored area" concept.

## Verification Plan

### Manual Verification
1. Run the local dev server.
2. Authenticate with Strava and fetch paths.
3. Toggle "Fog Mode" on.
4. Verify the screen dims and the paths reveal the map clearly.
5. Zoom and pan aggressively to ensure the canvas redraws correctly without massive framerate drops or memory leaks.
