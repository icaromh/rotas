import solver from 'javascript-lp-solver';

console.log('[Worker] Worker module carregado e inicializado com sucesso.');

export interface RouteRequest {
  polygon: { lat: number; lng: number }[];
  mode: 'bike' | 'walk';
}

export interface RouteResponse {
  type: 'success' | 'error';
  path?: { lat: number; lng: number }[];
  distance?: number;
  message?: string;
  rawInput?: {
    polygon: { lat: number; lng: number }[];
    mode: string;
    overpassData: any;
  };
}

// Custom Vanilla TS Graph Engine
export class CustomMultiGraph {
  private _nodes: Map<string, any>;
  private _outEdges: Map<string, Map<string, any[]>>; // source -> target -> edges[]
  private _inDegrees: Map<string, number>;
  private _outDegrees: Map<string, number>;
  private _edgeCounter: number = 0;

  constructor() {
    this._nodes = new Map();
    this._outEdges = new Map();
    this._inDegrees = new Map();
    this._outDegrees = new Map();
  }

  get order() { return this._nodes.size; }
  
  get size() {
    let count = 0;
    for (const targets of this._outEdges.values()) {
      for (const edges of targets.values()) {
        count += edges.length;
      }
    }
    return count;
  }

  addNode(id: string | number, attributes: any = {}) {
    const strId = String(id);
    if (!this._nodes.has(strId)) {
      this._nodes.set(strId, attributes);
      this._outEdges.set(strId, new Map());
      this._inDegrees.set(strId, 0);
      this._outDegrees.set(strId, 0);
    }
  }

  hasNode(id: string | number) {
    return this._nodes.has(String(id));
  }

  getNodeAttributes(id: string | number) {
    return this._nodes.get(String(id));
  }

  nodes() {
    return Array.from(this._nodes.keys());
  }

  addDirectedEdge(source: string | number, target: string | number, attributes: any = {}) {
    const s = String(source);
    const t = String(target);
    if (!this.hasNode(s)) this.addNode(s);
    if (!this.hasNode(t)) this.addNode(t);

    const edge = { id: String(this._edgeCounter++), source: s, target: t, attributes };
    
    if (!this._outEdges.get(s)!.has(t)) {
      this._outEdges.get(s)!.set(t, []);
    }
    this._outEdges.get(s)!.get(t)!.push(edge);

    this._outDegrees.set(s, this._outDegrees.get(s)! + 1);
    this._inDegrees.set(t, this._inDegrees.get(t)! + 1);
  }

  hasDirectedEdge(source: string | number, target: string | number) {
    const s = String(source);
    const t = String(target);
    return this._outEdges.has(s) && this._outEdges.get(s)!.has(t) && this._outEdges.get(s)!.get(t)!.length > 0;
  }

  forEachDirectedEdge(callback: (edgeId: string, attributes: any, source: string, target: string) => void) {
    for (const [source, targets] of this._outEdges.entries()) {
      for (const [target, edges] of targets.entries()) {
        for (const edge of edges) {
          callback(edge.id, edge.attributes, source, target);
        }
      }
    }
  }

  forEachNode(callback: (nodeId: string) => void) {
    for (const node of this._nodes.keys()) {
      callback(node);
    }
  }

  forEachOutNeighbor(node: string | number, callback: (neighbor: string) => void) {
    const s = String(node);
    const targets = this._outEdges.get(s);
    if (targets) {
      for (const target of targets.keys()) {
        callback(target);
      }
    }
  }

  outEdges(source: string | number, target: string | number) {
    const s = String(source);
    const t = String(target);
    const targets = this._outEdges.get(s);
    return targets && targets.has(t) ? targets.get(t)! : [];
  }

  inDegree(node: string | number) {
    return this._inDegrees.get(String(node)) || 0;
  }

  outDegree(node: string | number) {
    return this._outDegrees.get(String(node)) || 0;
  }
}

// Tarjan's SCC Algorithm
export function extractLargestSCC(g: CustomMultiGraph): CustomMultiGraph {
  console.log('[Worker] Step 3: Extraindo o maior Componente Fortemente Conectado (SCC)');
  let index = 0;
  const stack: string[] = [];
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const sccs: string[][] = [];

  const callStack: { v: string; neighbors: string[]; nextIdx: number }[] = [];

  g.forEachNode((startNode) => {
    if (!indices.has(startNode)) {
      const initialNeighbors: string[] = [];
      g.forEachOutNeighbor(startNode, w => initialNeighbors.push(w));
      
      indices.set(startNode, index);
      lowlinks.set(startNode, index);
      index++;
      stack.push(startNode);
      onStack.add(startNode);
      
      callStack.push({ v: startNode, neighbors: initialNeighbors, nextIdx: 0 });

      while (callStack.length > 0) {
        const top = callStack[callStack.length - 1];
        const v = top.v;
        
        if (top.nextIdx < top.neighbors.length) {
          const w = top.neighbors[top.nextIdx++];
          
          if (!indices.has(w)) {
            const wNeighbors: string[] = [];
            g.forEachOutNeighbor(w, nw => wNeighbors.push(nw));
            
            indices.set(w, index);
            lowlinks.set(w, index);
            index++;
            stack.push(w);
            onStack.add(w);
            
            callStack.push({ v: w, neighbors: wNeighbors, nextIdx: 0 });
          } else if (onStack.has(w)) {
            lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
          }
        } else {
          callStack.pop();
          
          if (callStack.length > 0) {
             const caller = callStack[callStack.length - 1];
             lowlinks.set(caller.v, Math.min(lowlinks.get(caller.v)!, lowlinks.get(v)!));
          }
          
          if (lowlinks.get(v) === indices.get(v)) {
            const scc: string[] = [];
            let w: string;
            do {
              w = stack.pop()!;
              onStack.delete(w);
              scc.push(w);
            } while (w !== v);
            sccs.push(scc);
          }
        }
      }
    }
  });

  console.log(`[Worker] Encontrados ${sccs.length} componentes conectados.`);
  let largest: string[] = [];
  for (const scc of sccs) {
    if (scc.length > largest.length) largest = scc;
  }
  
  const largestGraph = new CustomMultiGraph();
  for (const node of largest) {
    largestGraph.addNode(node, g.getNodeAttributes(node));
  }
  
  g.forEachDirectedEdge((_edgeId, attributes, source, target) => {
    if (largestGraph.hasNode(source) && largestGraph.hasNode(target)) {
      largestGraph.addDirectedEdge(source, target, attributes);
    }
  });
  
  console.log(`[Worker] Grafo fortemente conectado reduzido para ${largestGraph.order} nós e ${largestGraph.size} arestas.`);
  return largestGraph;
}

// Haversine distance in meters
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function fetchOverpass(polygon: {lat: number, lng: number}[], mode: 'bike' | 'walk') {
  console.log(`[Worker] Step 1: Iniciando fetch do Overpass API para modo: ${mode}`);
  
  // Calculate bounding box and add buffer
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of polygon) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const buffer = 0.002; // Approx 200m
  minLat -= buffer;
  maxLat += buffer;
  minLng -= buffer;
  maxLng += buffer;

  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;
  
  // Aggressive filter to eliminate sidewalks, cycleways, and service alleys.
  // This drastically simplifies the map, collapsing complex avenues into single primary routes.
  const wayFilter = `["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)$"]`;

  const query = `
    [out:json][timeout:25];
    (
      way${wayFilter}(${bboxStr});
    );
    out body;
    >;
    out skel qt;
  `;

  const endpoints = [
    'https://rotas-overpass-proxy.icaro-mh.workers.dev/'
  ];

  console.log('[Worker] Query enviada para Overpass API:', query);

  for (const endpoint of endpoints) {
    try {
      console.log(`[Worker] Tentando endpoint: ${endpoint}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds max per endpoint
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: query,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Worker] Endpoint ${endpoint} retornou erro: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[Worker] Dados recebidos do Overpass (${endpoint}). Elementos: ${data.elements?.length || 0}`);
      return data;
    } catch (err) {
      console.warn(`[Worker] Falha no endpoint ${endpoint} (pode ser CORS/Timeout):`, err);
    }
  }

  throw new Error('Falha ao obter dados do Overpass API. Todos os servidores falharam ou bloquearam por CORS. Tente novamente mais tarde.');
}

export interface BaseEdge {
  id: string;
  u: string;
  v: string;
  dist: number;
  isOneway: boolean;
  isTarget: boolean;
}

export function isPointInPolygon(point: {lat: number, lng: number}, vs: {lat: number, lng: number}[]) {
  let x = point.lng, y = point.lat;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].lng, yi = vs[i].lat;
    let xj = vs[j].lng, yj = vs[j].lat;
    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function buildBaseData(overpassData: any, mode: string, polygon: {lat: number, lng: number}[]) {
  console.log('[Worker] Step 2: Extraindo ruas e interseções base');
  const nodes = new Map<number, {lat: number, lon: number}>();
  
  for (const element of overpassData.elements) {
    if (element.type === 'node') {
      nodes.set(element.id, { lat: element.lat, lon: element.lon });
    }
  }

  const baseEdges: BaseEdge[] = [];
  let edgeCounter = 0;

  for (const element of overpassData.elements) {
    if (element.type === 'way' && element.nodes) {
      const isOneway = mode === 'walk' ? false : (element.tags?.oneway === 'yes' || element.tags?.oneway === '1' || element.tags?.oneway === '-1');
      
      for (let i = 0; i < element.nodes.length - 1; i++) {
        const u = element.nodes[i];
        const v = element.nodes[i + 1];
        
        if (!nodes.has(u) || !nodes.has(v)) continue;
        
        const posU = nodes.get(u)!;
        const posV = nodes.get(v)!;
        const dist = haversine(posU.lat, posU.lon, posV.lat, posV.lon);
        const midLat = (posU.lat + posV.lat) / 2;
        const midLng = (posU.lon + posV.lon) / 2;
        const isTarget = isPointInPolygon({lat: midLat, lng: midLng}, polygon);
        
        baseEdges.push({
          id: `e${edgeCounter++}`,
          u: String(u),
          v: String(v),
          dist,
          isOneway,
          isTarget
        });
      }
    }
  }
  
  console.log(`[Worker] Base gerada com ${baseEdges.length} segmentos de rua.`);
  return { nodes, baseEdges };
}

function solveMCPPHeuristic(nodes: Map<number, any>, sccGraph: CustomMultiGraph, baseEdges: BaseEdge[], mode: string): CustomMultiGraph {
  const eulerGraph = new CustomMultiGraph();
  sccGraph.forEachNode(n => {
    eulerGraph.addNode(n, nodes.get(Number(n)));
  });

  const balances = new Map<string, number>();
  sccGraph.forEachNode(n => balances.set(n, 0));

  const adj = new Map<string, {to: string, dist: number, id: string, penalty: number}[]>();
  sccGraph.forEachNode(n => adj.set(n, []));

  baseEdges.forEach(e => {
    if (!sccGraph.hasNode(e.u) || !sccGraph.hasNode(e.v)) return;

    if (e.isTarget) {
      eulerGraph.addDirectedEdge(e.u, e.v, { id: e.id, distance: e.dist });
      balances.set(e.u, balances.get(e.u)! - 1);
      balances.set(e.v, balances.get(e.v)! + 1);
    }
    
    adj.get(e.u)!.push({ to: e.v, dist: e.dist, id: e.id, penalty: 1 });
    const penalty = (e.isOneway && mode === 'bike') ? 2000 : 1;
    adj.get(e.v)!.push({ to: e.u, dist: e.dist * penalty, id: e.id, penalty: penalty });
  });

  // Calculate shortest path trees from every node that needs outgoing edges (balance > 0)
  // to nodes that need incoming edges (balance < 0)
  
  const sources = Array.from(balances.entries()).filter(b => b[1] > 0).map(b => ({ node: b[0], amt: b[1] }));
  const sinks = Array.from(balances.entries()).filter(b => b[1] < 0).map(b => ({ node: b[0], amt: -b[1] }));

  // Simplistic greedy matching
  for (const src of sources) {
    while (src.amt > 0) {
      // Find shortest path to any sink with amt > 0
      const dists = new Map<string, { dist: number, prev: string | null, edgeId: string | null }>();
      sccGraph.forEachNode(n => dists.set(n, { dist: Infinity, prev: null, edgeId: null }));
      dists.set(src.node, { dist: 0, prev: null, edgeId: null });
      
      const q = new Set<string>(sccGraph.nodes());
      let closestSink: typeof sinks[0] | null = null;
      let minDistToSink = Infinity;

      while (q.size > 0) {
        let u: string | null = null;
        let minD = Infinity;
        for (const n of q) {
          if (dists.get(n)!.dist < minD) {
            minD = dists.get(n)!.dist;
            u = n;
          }
        }
        
        if (!u || minD === Infinity) break;
        q.delete(u);

        const possibleSink = sinks.find(s => s.node === u && s.amt > 0);
        if (possibleSink && minD < minDistToSink) {
          closestSink = possibleSink;
          minDistToSink = minD;
          break; // Since edges are positive, first reached sink isn't necessarily absolute closest without full search, but this is a heuristic
        }

        for (const edge of adj.get(u)!) {
          if (!q.has(edge.to)) continue;
          const alt = minD + (edge.dist * edge.penalty);
          if (alt < dists.get(edge.to)!.dist) {
            dists.set(edge.to, { dist: alt, prev: u, edgeId: edge.id });
          }
        }
      }

      if (!closestSink) {
        // No reachable sink, which shouldn't happen in a strongly connected component
        break;
      }

      // Add path to eulerGraph
      let curr = closestSink.node;
      const path: {from: string, to: string, id: string}[] = [];
      while (curr !== src.node) {
        const p = dists.get(curr)!;
        path.push({ from: p.prev!, to: curr, id: p.edgeId! });
        curr = p.prev!;
      }
      
      // Path is built from sink to source, so reverse it
      for (let i = path.length - 1; i >= 0; i--) {
        const e = path[i];
        eulerGraph.addDirectedEdge(e.from, e.to, { id: e.id, distance: 0 }); // dist doesn't strictly matter for drawing
      }

      src.amt--;
      closestSink.amt--;
    }
  }

  console.log(`[Worker] Heurística gulosa gerou um Grafo Euleriano com ${eulerGraph.order} nós e ${eulerGraph.size} arestas.`);
  return eulerGraph;
}

export function solveMCPPAndBuildEulerianGraph(nodes: Map<number, any>, sccGraph: CustomMultiGraph, baseEdges: BaseEdge[], mode: string): CustomMultiGraph {
  console.log('[Worker] Step 4: Resolvendo o Mixed Chinese Postman Problem com LP Solver');
  
  const sccEdges = baseEdges.filter(e => sccGraph.hasNode(e.u) && sccGraph.hasNode(e.v));
  
  if (sccEdges.length > 1000) {
    console.log('[Worker] Grafo muito grande. Usando Heurística Gulosa para MCPP...');
    return solveMCPPHeuristic(nodes, sccGraph, baseEdges, mode);
  }

  const model: any = {
    optimize: "cost",
    opType: "min",
    constraints: {},
    variables: {}
  };

  sccGraph.forEachNode(node => {
    model.constraints[`bal_${node}`] = { equal: 0 };
  });

  sccEdges.forEach(e => {
    model.constraints[`req_${e.id}`] = { min: e.isTarget ? 1 : 0 };
    
    model.variables[`fwd_${e.id}`] = {
      cost: e.dist,
      [`req_${e.id}`]: 1,
      [`bal_${e.u}`]: -1,
      [`bal_${e.v}`]: 1
    };
    const penalty = (e.isOneway && mode === 'bike') ? 2000 : 1;
    model.variables[`rev_${e.id}`] = {
      cost: e.dist * penalty,
      [`req_${e.id}`]: 1,
      [`bal_${e.v}`]: -1,
      [`bal_${e.u}`]: 1
    };
  });

  console.log('[Worker] Enviando modelo matemático para o Solver LP. Isso pode levar alguns segundos...');
  let result: Record<string, number>;
  try {
    result = solver.Solve(model) as Record<string, number>;
  } catch (err) {
    console.log('[Worker] Falha no LP Solver. Caindo para Heurística Gulosa...', err);
    return solveMCPPHeuristic(nodes, sccGraph, baseEdges, mode);
  }
  
  if (!result.feasible) {
    console.log('[Worker] LP Solver insolúvel. Caindo para Heurística Gulosa...');
    return solveMCPPHeuristic(nodes, sccGraph, baseEdges, mode);
  }
  
  console.log(`[Worker] Solver finalizado com sucesso! Custo ótimo (distância): ${(result.result / 1000).toFixed(2)} km`);

  const eulerGraph = new CustomMultiGraph();
  sccGraph.forEachNode(n => {
    eulerGraph.addNode(n, nodes.get(Number(n)));
  });

  baseEdges.forEach(e => {
    if (!sccGraph.hasNode(e.u) || !sccGraph.hasNode(e.v)) return;

    // FWD edges
    const fwdCount = Math.round(result[`fwd_${e.id}`] || 0);
    for (let i = 0; i < fwdCount; i++) {
      eulerGraph.addDirectedEdge(e.u, e.v, { id: e.id, distance: e.dist });
    }

    // REV edges
    const revCount = Math.round(result[`rev_${e.id}`] || 0);
    for (let i = 0; i < revCount; i++) {
      eulerGraph.addDirectedEdge(e.v, e.u, { id: e.id, distance: e.dist });
    }
  });

  console.log(`[Worker] Grafo Euleriano construído com ${eulerGraph.order} nós e ${eulerGraph.size} arestas para a rota contínua.`);
  return eulerGraph;
}

export function hierholzer(g: CustomMultiGraph): string[] {
  console.log('[Worker] Step 5: Iniciando algoritmo de Hierholzer para extrair o Circuito Euleriano');
  if (g.order === 0) return [];
  
  const circuit: string[] = [];
  const currentPath: string[] = [];
  
  const adj = new Map<string, string[]>();
  g.forEachNode((node) => adj.set(node, []));
  
  g.forEachDirectedEdge((_edgeId, _attr, source, target) => {
    adj.get(source)!.push(target);
  });
  
  let startNode = g.nodes()[0];
  for (const n of g.nodes()) {
    if (adj.get(n)!.length > 0) {
      startNode = n;
      break;
    }
  }
  
  if (adj.get(startNode)!.length === 0) {
    // Grafo não tem arestas
    return [];
  }

  currentPath.push(startNode);
  let curr = startNode;
  
  while (currentPath.length > 0) {
    if (adj.get(curr)!.length > 0) {
      currentPath.push(curr);
      const next = adj.get(curr)!.pop()!;
      curr = next;
    } else {
      circuit.push(curr);
      curr = currentPath.pop()!;
    }
  }
  
  console.log(`[Worker] Circuito final gerado com ${circuit.length} nós no caminho.`);
  return circuit.reverse();
}

if (typeof self !== 'undefined') {
self.onmessage = async (e: MessageEvent<RouteRequest>) => {
  console.log('[Worker] Recebida solicitação de geração de rota:', e.data);
  const { polygon, mode } = e.data;
  let overpassData: any = null;
  try {
    // 1. Fetch Data
    overpassData = await fetchOverpass(polygon, mode);
    
    // 2. Build Base Data
    const { nodes, baseEdges } = buildBaseData(overpassData, mode, polygon);
    
    if (baseEdges.length === 0) {
      self.postMessage({ type: 'error', message: 'Nenhuma rua válida encontrada nesta região para o modo selecionado.', rawInput: { polygon, mode, overpassData } });
      return;
    }

    // Prepare graph for SCC extraction (treat as undirected to ensure connectivity inside the drawn polygon)
    const sccCheckGraph = new CustomMultiGraph();
    baseEdges.forEach(edge => {
      sccCheckGraph.addNode(edge.u, nodes.get(Number(edge.u)));
      sccCheckGraph.addNode(edge.v, nodes.get(Number(edge.v)));
      sccCheckGraph.addDirectedEdge(edge.u, edge.v, {});
      sccCheckGraph.addDirectedEdge(edge.v, edge.u, {});
    });
    
    // 3. Extract SCC
    const sccGraph = extractLargestSCC(sccCheckGraph);
    
    if (sccGraph.order === 0) {
      self.postMessage({ type: 'error', message: 'As ruas encontradas não formam uma rede conectada.', rawInput: { polygon, mode, overpassData } });
      return;
    }
    
    // 4. Solve MCPP using LP Solver
    const eulerGraph = solveMCPPAndBuildEulerianGraph(nodes, sccGraph, baseEdges, mode);
    
    // 5. Generate Eulerian Circuit
    const circuitNodeIds = hierholzer(eulerGraph);
    
    // Calculate total distance and format path
    let totalDistanceMeters = 0;
    const finalPath: {lat: number, lng: number}[] = [];
    
    for (let i = 0; i < circuitNodeIds.length - 1; i++) {
      const u = circuitNodeIds[i];
      const v = circuitNodeIds[i+1];
      const posU = eulerGraph.getNodeAttributes(u);
      
      if (i === 0) finalPath.push({ lat: posU.lat, lng: posU.lon });
      
      // Find edge length
      const edges = eulerGraph.outEdges(u, v);
      if (edges.length > 0) {
          const dist = edges[0].attributes.distance;
          totalDistanceMeters += dist;
      }
      
      const posV = eulerGraph.getNodeAttributes(v);
      finalPath.push({ lat: posV.lat, lng: posV.lon });
      
      // Remove used edge for multi-edge traversal tracking (hierholzer returns node path, not edge path, so we manually consume one edge to get the right distance sum)
      edges.shift(); 
    }
    
    console.log(`[Worker] Rota finalizada. Distância total apurada: ${(totalDistanceMeters / 1000).toFixed(2)} km`);
    self.postMessage({ 
      type: 'success', 
      path: finalPath, 
      distance: totalDistanceMeters / 1000,
      rawInput: {
        polygon,
        mode,
        overpassData
      }
    });
    
    } catch (err: any) {
      console.error('[Worker] Erro no processamento:', err);
      self.postMessage({ type: 'error', message: err.message || String(err), rawInput: { polygon, mode, overpassData } });
    }
};
}
