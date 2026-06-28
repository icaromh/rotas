const PROXY_URL = 'https://rotas-overpass-proxy.icaro-mh.workers.dev/api/interpreter';
const RAW_PROXY_URL = 'https://rotas-overpass-proxy.icaro-mh.workers.dev/';

export async function fetchNeighborhoods(bbox: string) {
  const query = `
    [out:json][timeout:25];
    (
      relation["admin_level"~"9|10"](${bbox});
      relation["place"~"neighbourhood|suburb"](${bbox});
    );
    out geom;
  `;

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });

  if (!res.ok) {
    throw new Error('Falha ao baixar bairros do OSM (Overpass).');
  }

  return await res.json();
}

export async function fetchRoadNetwork(polygon: { lat: number, lng: number }[], mode: 'bike' | 'walk', bufferMeters: number = 20, safety: string = 'any') {
  console.log(`[API] Step 1: Iniciando fetch do Overpass API para modo: ${mode}, buffer: ${bufferMeters}m, safety: ${safety}`);

  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of polygon) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const fetchBufferDegrees = Math.max(0.001, (bufferMeters * 0.00001) + 0.001);

  minLat -= fetchBufferDegrees;
  maxLat += fetchBufferDegrees;
  minLng -= fetchBufferDegrees;
  maxLng += fetchBufferDegrees;

  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;

  let wayFilter = `["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)$"]`;

  if (mode === 'bike') {
    if (safety === 'safe') {
      wayFilter = `["highway"~"^(secondary|tertiary|unclassified|residential|living_street|pedestrian|cycleway)$"]`;
      const cyclewayFilter = `way["cycleway"](${bboxStr});`;
      const explicitCycleFilter = `way["highway"="primary"]["cycleway"](${bboxStr});`;

      const query = `
        [out:json][timeout:25];
        (
          way${wayFilter}(${bboxStr});
          ${cyclewayFilter}
          ${explicitCycleFilter}
        );
        out body;
        >;
        out skel qt;
      `;

      const res = await fetch(RAW_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query)
      });
      if (!res.ok) throw new Error('Falha ao baixar dados do OSM (Overpass).');
      return await res.json();

    } else if (safety === 'strict') {
      wayFilter = `["highway"="cycleway"]`;
      const cyclewayFilter = `way["cycleway"](${bboxStr});`;
      const bicycleRoad = `way["bicycle_road"="yes"](${bboxStr});`;
      const strictQuery = `
        [out:json][timeout:25];
        (
          way${wayFilter}(${bboxStr});
          ${cyclewayFilter}
          ${bicycleRoad}
        );
        out body;
        >;
        out skel qt;
      `;

      const res = await fetch(RAW_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(strictQuery)
      });
      if (!res.ok) throw new Error('Falha ao baixar dados do OSM (Overpass).');
      return await res.json();
    }
  }

  const query = `
    [out:json][timeout:25];
    (
      way${wayFilter}(${bboxStr});
    );
    out body;
    >;
    out skel qt;
  `;

  console.log('[API] Query enviada para Overpass API:', query);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(RAW_PROXY_URL, {
      method: 'POST',
      body: query,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`[API] Endpoint retornou erro: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[API] Dados recebidos do Overpass. Elementos: ${data.elements?.length || 0}`);
    return data;
  } catch (err) {
    console.warn(`[API] Falha no endpoint (pode ser CORS/Timeout):`, err);
    throw new Error('Falha ao obter dados do Overpass API. Tente novamente mais tarde.');
  }
}
