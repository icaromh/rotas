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
}

// Custom Vanilla TS Graph Engine
class CustomMultiGraph {
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
function extractLargestSCC(g: CustomMultiGraph): CustomMultiGraph {
  console.log('[Worker] Step 3: Extraindo o maior Componente Fortemente Conectado (SCC)');
  let index = 0;
  const stack: string[] = [];
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const sccs: string[][] = [];

  function strongConnect(v: string) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    g.forEachOutNeighbor(v, (w) => {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    });

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

  g.forEachNode((v) => {
    if (!indices.has(v)) {
      strongConnect(v);
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

async function fetchOverpass(polygon: {lat: number, lng: number}[], mode: 'bike' | 'walk') {
  console.log(`[Worker] Step 1: Iniciando fetch do Overpass API para modo: ${mode}`);
  
  const polyStr = polygon.map(p => `${p.lat} ${p.lng}`).join(' ');
  
  // Aggressive filter to eliminate sidewalks, cycleways, and service alleys.
  // This drastically simplifies the map, collapsing complex avenues into single primary routes.
  const wayFilter = `["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)$"]`;

  const query = `
    [out:json][timeout:25];
    (
      way${wayFilter}(poly:"${polyStr}");
    );
    out body;
    >;
    out skel qt;
  `;

  console.log('[Worker] Query enviada para Overpass API:', query);
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query
  });

  if (!response.ok) throw new Error('Falha ao obter dados do Overpass API');
  const data = await response.json();
  console.log(`[Worker] Dados recebidos do Overpass. Elementos: ${data.elements?.length || 0}`);
  return data;
}

interface BaseEdge {
  id: string;
  u: string;
  v: string;
  dist: number;
  isOneway: boolean;
  pathFwd: {lat: number, lon: number}[];
  pathRev: {lat: number, lon: number}[];
}

function buildBaseData(overpassData: any) {
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
      const isOneway = element.tags?.oneway === 'yes' || element.tags?.oneway === '1' || element.tags?.oneway === '-1';
      const reverseCoords = element.tags?.oneway === '-1';
      
      let wayNodes = element.nodes;
      if (reverseCoords) {
        wayNodes = [...element.nodes].reverse();
      }
      
      for (let i = 0; i < wayNodes.length - 1; i++) {
        const u = wayNodes[i];
        const v = wayNodes[i + 1];
        
        if (!nodes.has(u) || !nodes.has(v)) continue;
        
        const posU = nodes.get(u)!;
        const posV = nodes.get(v)!;
        const dist = haversine(posU.lat, posU.lon, posV.lat, posV.lon);
        
        baseEdges.push({
          id: `e${edgeCounter++}`,
          u: String(u),
          v: String(v),
          dist,
          isOneway: isOneway, // if true, only u -> v is allowed
          pathFwd: [posU, posV],
          pathRev: [posV, posU]
        });
      }
    }
  }
  
  console.log(`[Worker] Base gerada com ${baseEdges.length} segmentos de rua.`);
  return { nodes, baseEdges };
}

function solveMCPPAndBuildEulerianGraph(nodes: Map<number, any>, sccGraph: CustomMultiGraph, baseEdges: BaseEdge[]): CustomMultiGraph {
  console.log('[Worker] Step 4: Resolvendo o Mixed Chinese Postman Problem com LP Solver');
  
  const sccEdges = baseEdges.filter(e => sccGraph.hasNode(e.u) && sccGraph.hasNode(e.v));
  
  const model: any = {
    optimize: "cost",
    opType: "min",
    constraints: {},
    variables: {},
    ints: {}
  };

  sccGraph.forEachNode(node => {
    model.constraints[`bal_${node}`] = { equal: 0 };
  });

  sccEdges.forEach(e => {
    model.constraints[`req_${e.id}`] = { min: 1 };
    
    // Forward variable (ida)
    model.variables[`fwd_${e.id}`] = {
      cost: e.dist,
      [`req_${e.id}`]: 1,
      [`bal_${e.u}`]: -1,
      [`bal_${e.v}`]: 1
    };
    model.ints[`fwd_${e.id}`] = 1;

    // Reverse variable (volta), only if not one-way
    if (!e.isOneway) {
      model.variables[`rev_${e.id}`] = {
        cost: e.dist,
        [`req_${e.id}`]: 1,
        [`bal_${e.v}`]: -1,
        [`bal_${e.u}`]: 1
      };
      model.ints[`rev_${e.id}`] = 1;
    }
  });

  console.log('[Worker] Enviando modelo matemático para o Solver LP. Isso pode levar alguns segundos...');
  const result = solver.Solve(model) as Record<string, number>;
  
  if (!result.feasible) {
    throw new Error('A malha viária selecionada é matematicamente insolúvel (não há rotas conectadas suficientes).');
  }
  
  console.log(`[Worker] Solver finalizado com sucesso! Custo ótimo (distância): ${(result.result / 1000).toFixed(2)} km`);

  const eulerGraph = new CustomMultiGraph();
  sccGraph.forEachNode(n => {
    eulerGraph.addNode(n, nodes.get(Number(n)));
  });

  sccEdges.forEach(e => {
    const fwdCount = Math.round(result[`fwd_${e.id}`] || 0);
    const revCount = Math.round(result[`rev_${e.id}`] || 0);

    for (let i = 0; i < fwdCount; i++) {
      eulerGraph.addDirectedEdge(e.u, e.v, { distance: e.dist, originalPath: e.pathFwd });
    }
    for (let i = 0; i < revCount; i++) {
      eulerGraph.addDirectedEdge(e.v, e.u, { distance: e.dist, originalPath: e.pathRev });
    }
  });

  console.log(`[Worker] Grafo Euleriano construído com ${eulerGraph.order} nós e ${eulerGraph.size} arestas para a rota contínua.`);
  return eulerGraph;
}

function hierholzer(g: CustomMultiGraph): string[] {
  console.log('[Worker] Step 5: Iniciando algoritmo de Hierholzer para extrair o Circuito Euleriano');
  if (g.order === 0) return [];
  
  const circuit: string[] = [];
  const currentPath: string[] = [];
  
  const adj = new Map<string, string[]>();
  g.forEachNode((node) => adj.set(node, []));
  
  g.forEachDirectedEdge((_edgeId, _attr, source, target) => {
    adj.get(source)!.push(target);
  });
  
  const startNode = g.nodes()[0];
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

self.onmessage = async (e: MessageEvent<RouteRequest>) => {
  console.log('[Worker] Recebida solicitação de geração de rota:', e.data);
  try {
    const { polygon, mode } = e.data;
    
    // 1. Fetch Data
    const overpassData = await fetchOverpass(polygon, mode);
    
    // 2. Build Base Data
    const { nodes, baseEdges } = buildBaseData(overpassData);
    
    if (baseEdges.length === 0) {
      self.postMessage({ type: 'error', message: 'Nenhuma rua válida encontrada nesta região para o modo selecionado.' });
      return;
    }

    // Prepare graph for SCC extraction (all possible directed edges)
    const sccCheckGraph = new CustomMultiGraph();
    baseEdges.forEach(edge => {
      sccCheckGraph.addNode(edge.u, nodes.get(Number(edge.u)));
      sccCheckGraph.addNode(edge.v, nodes.get(Number(edge.v)));
      sccCheckGraph.addDirectedEdge(edge.u, edge.v, {});
      if (!edge.isOneway) {
        sccCheckGraph.addDirectedEdge(edge.v, edge.u, {});
      }
    });
    
    // 3. Extract SCC
    const sccGraph = extractLargestSCC(sccCheckGraph);
    
    if (sccGraph.order === 0) {
      self.postMessage({ type: 'error', message: 'As ruas encontradas não formam uma rede conectada.' });
      return;
    }
    
    // 4. Solve MCPP using LP Solver
    const eulerGraph = solveMCPPAndBuildEulerianGraph(nodes, sccGraph, baseEdges);
    
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
      distance: totalDistanceMeters / 1000 // Convert to km
    });
    
  } catch (err: any) {
    console.error('[Worker] Erro crítico no pipeline:', err);
    self.postMessage({ type: 'error', message: err.message || 'Erro desconhecido no processamento.' });
  }
};
