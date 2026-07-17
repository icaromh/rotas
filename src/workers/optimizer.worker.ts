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

export interface BaseEdge {
  id: string;
  u: string;
  v: string;
  dist: number;
  isOneway: boolean;
  isTarget: boolean;
}

export function isPointInPolygon(point: {lat: number, lng: number}, vs: {lat: number, lng: number}[]) {
  const x = point.lng, y = point.lat;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].lng, yi = vs[i].lat;
    const xj = vs[j].lng, yj = vs[j].lat;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToSegment(p: {lat: number, lng: number}, v: {lat: number, lng: number}, w: {lat: number, lng: number}) {
  const l2 = (w.lng - v.lng) ** 2 + (w.lat - v.lat) ** 2;
  if (l2 === 0) return Math.sqrt((p.lng - v.lng) ** 2 + (p.lat - v.lat) ** 2);
  let t = ((p.lng - v.lng) * (w.lng - v.lng) + (p.lat - v.lat) * (w.lat - v.lat)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.lng + t * (w.lng - v.lng);
  const projY = v.lat + t * (w.lat - v.lat);
  return Math.sqrt((p.lng - projX) ** 2 + (p.lat - projY) ** 2);
}

function isPointInOrNearPolygon(point: {lat: number, lng: number}, polygon: {lat: number, lng: number}[], bufferDegrees: number = 0.0002) {
  if (isPointInPolygon(point, polygon)) return true;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (distanceToSegment(point, polygon[i], polygon[j]) <= bufferDegrees) return true;
  }
  return false;
}

export function buildBaseData(overpassData: any, mode: string, polygon: {lat: number, lng: number}[], bufferMeters: number = 20) {
  console.log(`[Worker] Step 2: Construindo grafo base com bufferMeters: ${bufferMeters}m`);
  const nodes = new Map<number, any>();
  
  for (const element of overpassData.elements) {
    if (element.type === 'node') {
      nodes.set(element.id, element);
    }
  }

  const baseEdges: BaseEdge[] = [];
  const bufferDegrees = bufferMeters * 0.00001; // Approx conversion
  
  for (const element of overpassData.elements) {
    if (element.type === 'way' && element.nodes) {
      const isOneway = mode === 'walk' ? false : (element.tags?.oneway === 'yes' || element.tags?.oneway === '1' || element.tags?.oneway === '-1');
      
      for (let i = 0; i < element.nodes.length - 1; i++) {
        const u = element.nodes[i];
        const v = element.nodes[i+1];
        
        const posU = nodes.get(u);
        const posV = nodes.get(v);
        
        if (!posU || !posV) continue;

        const dist = haversine(posU.lat, posU.lon, posV.lat, posV.lon);
        
        const midLat = (posU.lat + posV.lat) / 2;
        const midLng = (posU.lon + posV.lon) / 2;
        
        const inMid = isPointInOrNearPolygon({lat: midLat, lng: midLng}, polygon, bufferDegrees);
        const inU = isPointInOrNearPolygon({lat: posU.lat, lng: posU.lon}, polygon, bufferDegrees);
        const inV = isPointInOrNearPolygon({lat: posV.lat, lng: posV.lon}, polygon, bufferDegrees);

        let isTarget = false;
        if (mode === 'walk' && safety === 'strict') {
          // Both nodes must be inside or near the polygon
          isTarget = inU && inV;
        } else {
          isTarget = inMid || inU || inV;
        }

        baseEdges.push({
          u: String(u),
          v: String(v),
          dist,
          isTarget,
          id: String(element.id),
          isOneway
        });
      }
    }
  }

  console.log(`[Worker] Base gerada com ${baseEdges.length} segmentos de rua.`);
  return { nodes, baseEdges };
}

function solveMCPPHeuristic(nodes: Map<number, any>, sccGraph: CustomMultiGraph, baseEdges: BaseEdge[], mode: string): CustomMultiGraph {
  const eulerGraph = new CustomMultiGraph();
  
  const balances = new Map<string, number>();
  sccGraph.forEachNode(n => balances.set(n, 0));

  const adj = new Map<string, {to: string, dist: number, id: string, penalty: number}[]>();
  sccGraph.forEachNode(n => adj.set(n, []));

  baseEdges.forEach(e => {
    if (!sccGraph.hasNode(e.u) || !sccGraph.hasNode(e.v)) return;

    if (e.isTarget) {
      eulerGraph.addNode(e.u, nodes.get(Number(e.u)));
      eulerGraph.addNode(e.v, nodes.get(Number(e.v)));
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
        eulerGraph.addNode(e.from, nodes.get(Number(e.from)));
        eulerGraph.addNode(e.to, nodes.get(Number(e.to)));
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

  baseEdges.forEach(e => {
    if (!sccGraph.hasNode(e.u) || !sccGraph.hasNode(e.v)) return;

    // FWD edges
    const fwdCount = Math.round(result[`fwd_${e.id}`] || 0);
    for (let i = 0; i < fwdCount; i++) {
      eulerGraph.addNode(e.u, nodes.get(Number(e.u)));
      eulerGraph.addNode(e.v, nodes.get(Number(e.v)));
      eulerGraph.addDirectedEdge(e.u, e.v, { id: e.id, distance: e.dist });
    }

    // REV edges
    const revCount = Math.round(result[`rev_${e.id}`] || 0);
    for (let i = 0; i < revCount; i++) {
      eulerGraph.addNode(e.v, nodes.get(Number(e.v)));
      eulerGraph.addNode(e.u, nodes.get(Number(e.u)));
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

function connectEulerianComponents(eulerGraph: CustomMultiGraph, sccGraph: CustomMultiGraph) {
  console.log('[Worker] Verificando conectividade do Grafo Euleriano...');
  const activeNodes = new Set<string>();
  eulerGraph.forEachNode(n => {
    if (eulerGraph.outDegree(n) > 0 || eulerGraph.inDegree(n) > 0) activeNodes.add(n);
  });

  if (activeNodes.size === 0) return;

  const eulerAdj = new Map<string, string[]>();
  activeNodes.forEach(n => eulerAdj.set(n, []));
  eulerGraph.forEachDirectedEdge((_id, _attr, u, v) => {
    if (activeNodes.has(u) && activeNodes.has(v)) {
      eulerAdj.get(u)!.push(v);
      eulerAdj.get(v)!.push(u);
    }
  });

  const components: Set<string>[] = [];
  const visited = new Set<string>();

  for (const n of activeNodes) {
    if (!visited.has(n)) {
      const comp = new Set<string>();
      const q = [n];
      visited.add(n);
      comp.add(n);
      
      let head = 0;
      while (head < q.length) {
        const curr = q[head++];
        const neighbors = eulerAdj.get(curr);
        if (neighbors) {
          for (const nbr of neighbors) {
            if (!visited.has(nbr)) {
              visited.add(nbr);
              comp.add(nbr);
              q.push(nbr);
            }
          }
        }
      }
      components.push(comp);
    }
  }

  console.log(`[Worker] Grafo Euleriano tem ${components.length} componentes conectados.`);
  if (components.length <= 1) return;

  const sccAdj = new Map<string, {to: string, dist: number, id: string}[]>();
  sccGraph.forEachNode(n => sccAdj.set(n, []));
  sccGraph.forEachDirectedEdge((id, attr, u, v) => {
    sccAdj.get(u)!.push({ to: v, dist: attr.distance || 1, id });
  });

  let mainComp = components[0];

  for (let i = 1; i < components.length; i++) {
    const targetComp = components[i];
    
    const dists = new Map<string, number>();
    const prev = new Map<string, {node: string, edgeId: string}>();
    const q = new Set<string>();
    
    sccGraph.forEachNode(n => {
      if (mainComp.has(n)) {
        dists.set(n, 0);
        q.add(n);
      } else {
        dists.set(n, Infinity);
      }
    });

    let bestTarget: string | null = null;
    while (q.size > 0) {
      let u: string | null = null;
      let d = Infinity;
      for (const n of q) {
        const dn = dists.get(n)!;
        if (dn < d) { d = dn; u = n; }
      }
      if (!u || d === Infinity) break;
      q.delete(u);

      if (targetComp.has(u)) {
        bestTarget = u;
        break; 
      }

      for (const edge of sccAdj.get(u)!) {
        const alt = d + edge.dist;
        if (alt < (dists.get(edge.to) || Infinity)) {
          dists.set(edge.to, alt);
          prev.set(edge.to, { node: u, edgeId: edge.id });
          q.add(edge.to);
        }
      }
    }

    if (bestTarget) {
      const pathFwd: {u: string, v: string, id: string, dist: number}[] = [];
      let curr = bestTarget;
      while (!mainComp.has(curr)) {
        const p = prev.get(curr)!;
        pathFwd.push({ u: p.node, v: curr, id: p.edgeId, dist: 0 });
        curr = p.node;
      }
      pathFwd.reverse();

      const startNode = pathFwd[0].u;
      const endNode = bestTarget;

      // Run Dijkstra from endNode to startNode to perfectly balance degrees
      const distsBack = new Map<string, number>();
      const prevBack = new Map<string, {node: string, edgeId: string}>();
      const qBack = new Set<string>();
      
      sccGraph.forEachNode(n => {
        distsBack.set(n, Infinity);
        qBack.add(n);
      });
      distsBack.set(endNode, 0);

      let found = false;
      while (qBack.size > 0) {
        let u: string | null = null;
        let d = Infinity;
        for (const n of qBack) {
          const dn = distsBack.get(n)!;
          if (dn < d) { d = dn; u = n; }
        }
        if (!u || d === Infinity) break;
        qBack.delete(u);

        if (u === startNode) {
          found = true;
          break; 
        }

        for (const edge of sccAdj.get(u)!) {
          const alt = d + edge.dist;
          if (alt < (distsBack.get(edge.to) || Infinity)) {
            distsBack.set(edge.to, alt);
            prevBack.set(edge.to, { node: u, edgeId: edge.id });
            qBack.add(edge.to);
          }
        }
      }

      if (found) {
        let currBack = startNode;
        while (currBack !== endNode) {
          const p = prevBack.get(currBack)!;
          eulerGraph.addNode(p.node, sccGraph.getNodeAttributes(p.node));
          eulerGraph.addNode(currBack, sccGraph.getNodeAttributes(currBack));
          eulerGraph.addDirectedEdge(p.node, currBack, { id: p.edgeId, distance: 0 });
          currBack = p.node;
        }
        
        for (const e of pathFwd) {
          eulerGraph.addNode(e.u, sccGraph.getNodeAttributes(e.u));
          eulerGraph.addNode(e.v, sccGraph.getNodeAttributes(e.v));
          eulerGraph.addDirectedEdge(e.u, e.v, { id: e.id, distance: 0 });
        }
        
        for (const n of targetComp) {
          mainComp.add(n);
        }
      } else {
        console.warn(`[Worker] Não foi possível encontrar caminho de volta de ${endNode} para ${startNode}! A conectividade falhou para este componente.`);
      }
    }
  }
}

if (typeof self !== 'undefined') {
self.onmessage = async (e: MessageEvent<any>) => {
  console.log('[Worker] Recebida solicitação de geração de rota:', e.data);
  const { polygon, mode, overpassData, bufferMeters = 20, safety = 'any' } = e.data;
  
  if (!overpassData) {
    self.postMessage({ type: 'error', message: 'Faltam dados do Overpass API para processamento.', rawInput: { polygon, mode } });
    return;
  }

  try {
    // 2. Build Base Data
    const { nodes, baseEdges } = buildBaseData(overpassData, mode, polygon, bufferMeters);
    
    if (baseEdges.length === 0) {
      self.postMessage({ type: 'error', message: 'Nenhuma rua válida encontrada nesta região para o modo selecionado.', rawInput: { polygon, mode, overpassData } });
      return;
    }

    // Prepare graph for SCC extraction (treat as undirected to ensure connectivity inside the drawn polygon)
    const sccCheckGraph = new CustomMultiGraph();
    baseEdges.forEach(edge => {
      sccCheckGraph.addNode(edge.u, nodes.get(Number(edge.u)));
      sccCheckGraph.addNode(edge.v, nodes.get(Number(edge.v)));
      sccCheckGraph.addDirectedEdge(edge.u, edge.v, { distance: edge.dist, id: edge.id });
      sccCheckGraph.addDirectedEdge(edge.v, edge.u, { distance: edge.dist, id: edge.id });
    });
    
    // 3. Extract SCC
    const sccGraph = extractLargestSCC(sccCheckGraph);
    
    if (sccGraph.order === 0) {
      self.postMessage({ type: 'error', message: 'As ruas encontradas não formam uma rede conectada.', rawInput: { polygon, mode, overpassData } });
      return;
    }
    
    // 4. Solve MCPP using LP Solver
    const eulerGraph = solveMCPPAndBuildEulerianGraph(nodes, sccGraph, baseEdges, mode);
    
    // Conecta componentes desconexos para resolver o problema de polígonos que picotam as ruas
    connectEulerianComponents(eulerGraph, sccGraph);

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
        overpassData,
        bufferMeters,
        safety
      }
    });
    
    } catch (err: any) {
      console.error('[Worker] Erro no processamento:', err);
      self.postMessage({ type: 'error', message: err.message || String(err), rawInput: { polygon, mode, overpassData } });
    }
};
}
