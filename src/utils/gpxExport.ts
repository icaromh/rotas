import type { Point } from './routeSharing';

/**
 * Builds a GPX XML string from an array of {lat, lng} points.
 */
export function buildGpxContent(path: Point[], routeName = 'Optimized Route'): string {
  let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
  gpx += '<gpx version="1.1" creator="Rotas App">\n';
  gpx += '  <trk>\n';
  gpx += `    <name>${routeName}</name>\n`;
  gpx += '    <trkseg>\n';
  path.forEach(p => {
    gpx += `      <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>\n`;
  });
  gpx += '    </trkseg>\n';
  gpx += '  </trk>\n';
  gpx += '</gpx>';
  return gpx;
}

/**
 * Generates a GPX file from the given path and triggers a browser download.
 * Returns early (no-op) when path is empty.
 */
export function downloadGpx(path: Point[], filename = 'rotas-optimized.gpx'): void {
  if (path.length === 0) return;

  const content = buildGpxContent(path);
  const blob = new Blob([content], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
