import { MultiDirectedGraph } from 'graphology';
import { stronglyConnectedComponents } from 'graphology-components';
import solver from 'javascript-lp-solver';

export interface RouteRequest {
  bounds: { north: number; south: number; east: number; west: number };
  mode: 'bike' | 'walk';
}

export interface RouteResponse {
  type: 'success' | 'error';
  path?: { lat: number; lng: number }[];
  distance?: number;
  message?: string;
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

async function fetchOverpass(bounds: any, mode: 'bike' | 'walk') {
  console.log(`[Worker] Step 1: Iniciando fetch do Overpass API para modo: ${mode}`);
  const { south, west, north, east } = bounds;
  let wayFilter = '';
  
  if (mode === 'bike') {
    wayFilter = `["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|steps|pedestrian"]["bicycle"!="no"]`;
  } else {
    wayFilter = `["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link"]["foot"!="no"]`;
  }

  const query = `
    [out:json][timeout:25];
    (
      way${wayFilter}(${south},${west},${north},${east});
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

function buildGraph(overpassData: any): MultiDirectedGraph {
  console.log('[Worker] Step 2: Construindo o Grafo Direcionado inicial');
  const g = new MultiDirectedGraph();
  const nodes = new Map<number, {lat: number, lon: number}>();
  
  for (const element of overpassData.elements) {
    if (element.type === 'node') {
      nodes.set(element.id, { lat: element.lat, lon: element.lon });
    }
  }

  for (const element of overpassData.elements) {
    if (element.type === 'way' && element.nodes) {
      const isOneway = element.tags?.oneway === 'yes' || element.tags?.oneway === '1';
      
      for (let i = 0; i < element.nodes.length - 1; i++) {
        const u = element.nodes[i];
        const v = element.nodes[i + 1];
        
        if (!nodes.has(u) || !nodes.has(v)) continue;
        
        const posU = nodes.get(u)!;
        const posV = nodes.get(v)!;
        
        if (!g.hasNode(u)) g.addNode(u, posU);
        if (!g.hasNode(v)) g.addNode(v, posV);
        
        const dist = haversine(posU.lat, posU.lon, posV.lat, posV.lon);
        
        // Add directed edge u -> v
        if (!g.hasDirectedEdge(u, v)) {
            g.addDirectedEdge(u, v, { distance: dist, originalPath: [posU, posV] });
        }
        
        // Add v -> u if not oneway
        if (!isOneway) {
          if (!g.hasDirectedEdge(v, u)) {
            g.addDirectedEdge(v, u, { distance: dist, originalPath: [posV, posU] });
          }
        }
      }
    }
  }
  console.log(`[Worker] Grafo construído com ${g.order} nós e ${g.size} arestas.`);
  return g;
}

function extractLargestSCC(g: MultiDirectedGraph): MultiDirectedGraph {
  console.log('[Worker] Step 3: Extraindo o maior Componente Fortemente Conectado (SCC)');
  const sccs = stronglyConnectedComponents(g);
  console.log(`[Worker] Encontrados ${sccs.length} componentes conectados.`);
  let largest: string[] = [];
  for (const scc of sccs) {
    if (scc.length > largest.length) largest = scc;
  }
  
  const largestGraph = new MultiDirectedGraph();
  for (const node of largest) {
    largestGraph.addNode(node, g.getNodeAttributes(node));
  }
  
  g.forEachDirectedEdge((_edge, attributes, source, target) => {
    if (largestGraph.hasNode(source) && largestGraph.hasNode(target)) {
      largestGraph.addDirectedEdge(source, target, attributes);
    }
  });
  
  console.log(`[Worker] Grafo fortemente conectado reduzido para ${largestGraph.order} nós e ${largestGraph.size} arestas.`);
  return largestGraph;
}

function dijkstraShortestPaths(g: MultiDirectedGraph, startNode: string) {
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const unvisited = new Set<string>();

  g.forEachNode((node) => {
    distances.set(node, Infinity);
    unvisited.add(node);
  });
  distances.set(startNode, 0);

  while (unvisited.size > 0) {
    let closestNode: string | null = null;
    let minDistance = Infinity;

    for (const node of unvisited) {
      const dist = distances.get(node)!;
      if (dist < minDistance) {
        minDistance = dist;
        closestNode = node;
      }
    }

    if (!closestNode || minDistance === Infinity) break;
    unvisited.delete(closestNode);

    g.forEachOutNeighbor(closestNode, (neighbor) => {
      if (!unvisited.has(neighbor)) return;
      
      const edges = g.outEdges(closestNode, neighbor);
      // find min edge
      let edgeWeight = Infinity;
      for (const e of edges) {
        const w = g.getEdgeAttribute(e, 'distance');
        if (w < edgeWeight) edgeWeight = w;
      }
      
      const alt = minDistance + edgeWeight;
      
      if (alt < distances.get(neighbor)!) {
        distances.set(neighbor, alt);
        previous.set(neighbor, closestNode);
      }
    });
  }

  return { distances, previous };
}

function balanceGraph(g: MultiDirectedGraph) {
  console.log('[Worker] Step 4: Balanceando o Grafo (Directed Chinese Postman Problem)');
  const excessNodes: { id: string; amount: number }[] = [];
  const deficitNodes: { id: string; amount: number }[] = [];

  g.forEachNode((node) => {
    const inDeg = g.inDegree(node);
    const outDeg = g.outDegree(node);
    const demand = inDeg - outDeg;
    
    if (demand > 0) excessNodes.push({ id: node, amount: demand });
    else if (demand < 0) deficitNodes.push({ id: node, amount: -demand });
  });

  console.log(`[Worker] Encontrados ${excessNodes.length} nós em excesso e ${deficitNodes.length} nós em déficit.`);

  if (excessNodes.length === 0 && deficitNodes.length === 0) {
    console.log('[Worker] O grafo já está balanceado!');
    return;
  }

  const model: any = {
    optimize: "cost",
    opType: "min",
    constraints: {},
    variables: {},
    ints: {}
  };

  for (const excess of excessNodes) {
    model.constraints[`excess_${excess.id}`] = { equal: excess.amount };
  }
  for (const deficit of deficitNodes) {
    model.constraints[`deficit_${deficit.id}`] = { equal: deficit.amount };
  }

  // Find shortest paths from all excess to all deficit
  const pathsMap = new Map<string, Map<string, string[]>>(); // excess -> deficit -> path

  for (const excess of excessNodes) {
    const { distances, previous } = dijkstraShortestPaths(g, excess.id);
    const deficitPaths = new Map<string, string[]>();

    for (const deficit of deficitNodes) {
      const dist = distances.get(deficit.id);
      if (dist !== undefined && dist < Infinity) {
        // Construct path
        const path: string[] = [];
        let curr = deficit.id;
        while (curr !== excess.id) {
          path.unshift(curr);
          curr = previous.get(curr)!;
        }
        path.unshift(excess.id);
        deficitPaths.set(deficit.id, path);

        // Add to LP model
        const varName = `flow_${excess.id}_${deficit.id}`;
        model.variables[varName] = {
          cost: dist,
          [`excess_${excess.id}`]: 1,
          [`deficit_${deficit.id}`]: 1
        };
        model.ints[varName] = 1;
      }
    }
    pathsMap.set(excess.id, deficitPaths);
  }

  console.log('[Worker] Modelo de LP montado. Resolvendo Fluxo de Custo Mínimo...');
  const result = solver.Solve(model) as Record<string, number>;
  console.log(`[Worker] LP resolvido. Custo ótimo: ${result.result}`);
  
  // Add duplicate edges based on LP result
  let duplicateEdgesCount = 0;
  for (const key of Object.keys(result)) {
    if (key.startsWith('flow_') && result[key] > 0) {
      const parts = key.split('_');
      const excessId = parts[1];
      const deficitId = parts[2];
      const flowCount = Math.round(result[key]);
      
      const path = pathsMap.get(excessId)!.get(deficitId)!;
      for (let f = 0; f < flowCount; f++) {
        for (let i = 0; i < path.length - 1; i++) {
          const u = path[i];
          const v = path[i+1];
          // Get the shortest edge between u and v to duplicate
          const edges = g.outEdges(u, v);
          let minEdge = edges[0];
          let minWt = g.getEdgeAttribute(minEdge, 'distance');
          for (let j=1; j<edges.length; j++) {
            const w = g.getEdgeAttribute(edges[j], 'distance');
            if (w < minWt) { minWt = w; minEdge = edges[j]; }
          }
          
          const edgeAttributes = g.getEdgeAttributes(minEdge);
          g.addDirectedEdge(u, v, { ...edgeAttributes, isDuplicate: true });
          duplicateEdgesCount++;
        }
      }
    }
  }
  console.log(`[Worker] Foram adicionadas ${duplicateEdgesCount} arestas artificiais (repetidas) para balanceamento.`);
}

function hierholzer(g: MultiDirectedGraph): string[] {
  console.log('[Worker] Step 5: Iniciando algoritmo de Hierholzer para extrair o Circuito Euleriano');
  if (g.order === 0) return [];
  
  const circuit: string[] = [];
  const currentPath: string[] = [];
  
  // We need to keep track of available edges since graphology allows multi-edges but standard iterators might be tricky if we modify during iteration
  // Let's create an adjacency list with counts/references
  const adj = new Map<string, string[]>();
  g.forEachNode((node) => adj.set(node, []));
  
  g.forEachDirectedEdge((_edge, _attr, source, target) => {
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
    const { bounds, mode } = e.data;
    
    // 1. Fetch Data
    const overpassData = await fetchOverpass(bounds, mode);
    
    // 2. Build Graph
    let graph = buildGraph(overpassData);
    
    if (graph.order === 0) {
      self.postMessage({ type: 'error', message: 'Nenhuma rua válida encontrada nesta região para o modo selecionado.' });
      return;
    }
    
    // 3. Extract SCC
    graph = extractLargestSCC(graph);
    
    if (graph.order === 0) {
      self.postMessage({ type: 'error', message: 'As ruas encontradas não formam uma rede conectada.' });
      return;
    }
    
    // 4. Balance Graph
    balanceGraph(graph);
    
    // 5. Generate Eulerian Circuit
    const circuitNodeIds = hierholzer(graph);
    
    // Calculate total distance and format path
    let totalDistanceMeters = 0;
    const finalPath: {lat: number, lng: number}[] = [];
    
    for (let i = 0; i < circuitNodeIds.length - 1; i++) {
      const u = circuitNodeIds[i];
      const v = circuitNodeIds[i+1];
      const posU = graph.getNodeAttributes(u);
      
      if (i === 0) finalPath.push({ lat: posU.lat, lng: posU.lon });
      
      // Find edge length
      const edges = graph.outEdges(u, v);
      if (edges.length > 0) {
          const dist = graph.getEdgeAttribute(edges[0], 'distance');
          totalDistanceMeters += dist;
      }
      
      const posV = graph.getNodeAttributes(v);
      finalPath.push({ lat: posV.lat, lng: posV.lon });
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
