/**
 * @file optimizer.test.ts
 *
 * Unit and integration tests for the route-optimizer Worker algorithms.
 *
 * The optimizer solves the **Mixed Chinese Postman Problem (MCPP)** — the
 * challenge of finding the shortest closed walk that traverses every required
 * street segment at least once. The pipeline is:
 *
 *   1. Fetch raw OSM data from Overpass API  (not tested here — I/O)
 *   2. buildBaseData   → parse OSM → list of directed base edges + node map
 *   3. extractLargestSCC → Tarjan's algorithm to keep only the Strongly
 *                          Connected Component that contains all "target" edges
 *   4. solveMCPPAndBuildEulerianGraph → LP Solver (or greedy fallback) to add
 *                                       the minimum extra traversals needed to
 *                                       turn the graph into an Eulerian one
 *   5. hierholzer      → extract the Eulerian circuit from the balanced graph
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  CustomMultiGraph,
  extractLargestSCC,
  buildBaseData,
  solveMCPPAndBuildEulerianGraph,
  hierholzer,
  isPointInPolygon,
  type BaseEdge,
} from '../src/workers/optimizer.worker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a simple directed cycle: node0 → node1 → node2 → node0 */
function makeTriangleCycleGraph(): CustomMultiGraph {
  const g = new CustomMultiGraph();
  g.addNode('0', { lat: 0, lon: 0 });
  g.addNode('1', { lat: 1, lon: 0 });
  g.addNode('2', { lat: 0, lon: 1 });
  g.addDirectedEdge('0', '1', { distance: 100 });
  g.addDirectedEdge('1', '2', { distance: 100 });
  g.addDirectedEdge('2', '0', { distance: 100 });
  return g;
}

/** Minimal OSM-like overpass payload with two connected ways */
function makeMinimalOverpassData(
  polygon: { lat: number; lng: number }[],
  oneway = false
) {
  // Lay out 3 nodes inside the polygon
  const elements: any[] = [
    { type: 'node', id: 1, lat: polygon[0].lat + 0.0001, lon: polygon[0].lng + 0.0001 },
    { type: 'node', id: 2, lat: polygon[1].lat - 0.0001, lon: polygon[1].lng - 0.0001 },
    { type: 'node', id: 3, lat: (polygon[0].lat + polygon[1].lat) / 2, lon: (polygon[0].lng + polygon[1].lng) / 2 },
    {
      type: 'way',
      id: 10,
      nodes: [1, 2, 3],
      tags: oneway ? { oneway: 'yes' } : {},
    },
  ];
  return { elements };
}

// ---------------------------------------------------------------------------
// Suite 1 – CustomMultiGraph
// ---------------------------------------------------------------------------

/**
 * CustomMultiGraph is the custom directed multi-graph data structure at the
 * heart of the optimizer. It supports parallel edges between the same pair of
 * nodes (multi-graph), which is required because the MCPP solution may add
 * multiple traversals of the same street.
 */
describe('CustomMultiGraph', () => {
  it('starts empty', () => {
    const g = new CustomMultiGraph();
    expect(g.order).toBe(0); // number of nodes
    expect(g.size).toBe(0);  // number of directed edges
  });

  it('addNode – nodes can be added and detected', () => {
    const g = new CustomMultiGraph();
    g.addNode('A', { label: 'alpha' });
    expect(g.hasNode('A')).toBe(true);
    expect(g.hasNode('B')).toBe(false);
    expect(g.order).toBe(1);
  });

  it('addNode – duplicate add is idempotent (no duplicate)', () => {
    const g = new CustomMultiGraph();
    g.addNode('X');
    g.addNode('X'); // second call should be a no-op
    expect(g.order).toBe(1);
  });

  it('addNode – numeric ids are coerced to strings', () => {
    const g = new CustomMultiGraph();
    g.addNode(42);
    expect(g.hasNode('42')).toBe(true);
    expect(g.hasNode(42)).toBe(true);
  });

  it('getNodeAttributes – returns the stored attributes', () => {
    const g = new CustomMultiGraph();
    g.addNode('n1', { lat: 10, lon: 20 });
    expect(g.getNodeAttributes('n1')).toEqual({ lat: 10, lon: 20 });
  });

  it('addDirectedEdge – degree counters are updated correctly', () => {
    const g = new CustomMultiGraph();
    g.addNode('A');
    g.addNode('B');
    g.addDirectedEdge('A', 'B', {});

    expect(g.outDegree('A')).toBe(1);
    expect(g.inDegree('B')).toBe(1);
    expect(g.inDegree('A')).toBe(0);
    expect(g.outDegree('B')).toBe(0);
  });

  it('addDirectedEdge – auto-creates missing nodes', () => {
    const g = new CustomMultiGraph();
    g.addDirectedEdge('X', 'Y', {});
    expect(g.hasNode('X')).toBe(true);
    expect(g.hasNode('Y')).toBe(true);
  });

  it('hasDirectedEdge – detects existing and missing edges', () => {
    const g = new CustomMultiGraph();
    g.addDirectedEdge('A', 'B', {});
    expect(g.hasDirectedEdge('A', 'B')).toBe(true);
    expect(g.hasDirectedEdge('B', 'A')).toBe(false); // directed, not undirected
  });

  it('size – counts multi-edges (parallel edges between same pair)', () => {
    const g = new CustomMultiGraph();
    g.addDirectedEdge('A', 'B', { x: 1 });
    g.addDirectedEdge('A', 'B', { x: 2 }); // second edge — same direction
    expect(g.size).toBe(2);
    expect(g.outDegree('A')).toBe(2);
  });

  it('outEdges – returns all parallel edges between two nodes', () => {
    const g = new CustomMultiGraph();
    g.addDirectedEdge('A', 'B', { distance: 10 });
    g.addDirectedEdge('A', 'B', { distance: 20 });
    const edges = g.outEdges('A', 'B');
    expect(edges).toHaveLength(2);
    const dists = edges.map((e: any) => e.attributes.distance).sort();
    expect(dists).toEqual([10, 20]);
  });

  it('nodes() – lists all node ids', () => {
    const g = new CustomMultiGraph();
    g.addNode('P');
    g.addNode('Q');
    expect(g.nodes().sort()).toEqual(['P', 'Q']);
  });

  it('forEachNode – iterates every node exactly once', () => {
    const g = new CustomMultiGraph();
    g.addNode('1'); g.addNode('2'); g.addNode('3');
    const seen: string[] = [];
    g.forEachNode(n => seen.push(n));
    expect(seen.sort()).toEqual(['1', '2', '3']);
  });

  it('forEachOutNeighbor – returns direct neighbours (not transitive)', () => {
    const g = new CustomMultiGraph();
    g.addDirectedEdge('A', 'B', {});
    g.addDirectedEdge('A', 'C', {});
    const neighbours: string[] = [];
    g.forEachOutNeighbor('A', n => neighbours.push(n));
    expect(neighbours.sort()).toEqual(['B', 'C']);
  });

  it('forEachDirectedEdge – iterates all edges with correct source/target', () => {
    const g = new CustomMultiGraph();
    g.addDirectedEdge('X', 'Y', { w: 5 });
    g.addDirectedEdge('Y', 'Z', { w: 3 });
    const edges: { src: string; tgt: string }[] = [];
    g.forEachDirectedEdge((_id, _attr, src, tgt) => edges.push({ src, tgt }));
    expect(edges).toHaveLength(2);
    expect(edges.some(e => e.src === 'X' && e.tgt === 'Y')).toBe(true);
    expect(edges.some(e => e.src === 'Y' && e.tgt === 'Z')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 – isPointInPolygon (Ray-casting algorithm)
// ---------------------------------------------------------------------------

/**
 * isPointInPolygon uses the ray-casting algorithm: it draws a horizontal ray
 * from the test point to the right and counts how many polygon edges it
 * crosses. An odd count → inside; even count → outside.
 *
 * This is used to decide which OSM road segments fall inside the user-drawn
 * polygon (and should be treated as "required" streets to traverse).
 */
describe('isPointInPolygon (ray-casting)', () => {
  // A simple 1×1 degree square centred around (0,0)
  const square = [
    { lat: -1, lng: -1 },
    { lat: -1, lng:  1 },
    { lat:  1, lng:  1 },
    { lat:  1, lng: -1 },
  ];

  it('returns true for a point clearly inside the polygon', () => {
    expect(isPointInPolygon({ lat: 0, lng: 0 }, square)).toBe(true);
  });

  it('returns false for a point clearly outside the polygon', () => {
    expect(isPointInPolygon({ lat: 5, lng: 5 }, square)).toBe(false);
  });

  it('returns false for a point just outside the polygon boundary', () => {
    // Boundary classification in ray-casting is implementation-defined.
    // We use a point clearly outside (below the bottom edge) to make the
    // test unambiguous. The bufferDegrees margin in the actual code handles
    // near-boundary edges separately.
    expect(isPointInPolygon({ lat: -1.5, lng: 0 }, square)).toBe(false);
  });

  it('handles a triangle polygon', () => {
    const triangle = [
      { lat: 0,  lng: 0 },
      { lat: 2,  lng: 0 },
      { lat: 1,  lng: 2 },
    ];
    expect(isPointInPolygon({ lat: 1, lng: 0.5 }, triangle)).toBe(true);
    expect(isPointInPolygon({ lat: 1, lng: 3 },   triangle)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 – extractLargestSCC  (Tarjan's Strongly Connected Components)
// ---------------------------------------------------------------------------

/**
 * Tarjan's SCC algorithm finds all groups of nodes where every node is
 * reachable from every other node by following directed edges.
 *
 * Why do we need it?
 * The Eulerian circuit can only exist on a strongly connected graph. If we
 * simply draw a polygon, some included road segments may be dead-ends or
 * one-way streets that break connectivity. We discard all nodes that are not
 * part of the largest SCC so the MCPP solver always operates on a valid
 * Eulerian-able subgraph.
 *
 * Properties tested:
 * - A single directed cycle → one SCC containing all nodes
 * - Two disconnected clusters → returns the bigger one
 * - A linear chain (no back-edges) → each node is its own SCC (size 1 each),
 *   so "largest SCC" has only 1 node
 */
describe('extractLargestSCC (Tarjan)', () => {
  it('returns all nodes when the graph is already one strongly-connected cycle', () => {
    const g = makeTriangleCycleGraph();
    // Make it bidirectional (as the pipeline does before calling SCC)
    g.addDirectedEdge('0', '2', { distance: 100 });
    g.addDirectedEdge('2', '1', { distance: 100 });
    g.addDirectedEdge('1', '0', { distance: 100 });

    const scc = extractLargestSCC(g);
    expect(scc.order).toBe(3);
  });

  it('selects the larger of two disconnected components', () => {
    const g = new CustomMultiGraph();

    // Large cycle: A ↔ B ↔ C ↔ A
    g.addDirectedEdge('A', 'B', {}); g.addDirectedEdge('B', 'A', {});
    g.addDirectedEdge('B', 'C', {}); g.addDirectedEdge('C', 'B', {});
    g.addDirectedEdge('C', 'A', {}); g.addDirectedEdge('A', 'C', {});

    // Tiny isolated cycle: X ↔ Y (no connections to A/B/C)
    g.addDirectedEdge('X', 'Y', {}); g.addDirectedEdge('Y', 'X', {});

    const scc = extractLargestSCC(g);
    // Must pick the A-B-C component
    expect(scc.order).toBe(3);
    expect(scc.hasNode('A')).toBe(true);
    expect(scc.hasNode('X')).toBe(false);
  });

  it('a linear chain (A→B→C) has no strong connectivity – each node is its own SCC', () => {
    const g = new CustomMultiGraph();
    g.addDirectedEdge('A', 'B', {});
    g.addDirectedEdge('B', 'C', {});
    // No back-edges, so no node can reach itself through the graph
    const scc = extractLargestSCC(g);
    // Each node is its own SCC of size 1, so "largest" is 1 node
    expect(scc.order).toBe(1);
  });

  it('edges within the SCC are preserved, cross-component edges are dropped', () => {
    const g = new CustomMultiGraph();
    // SCC component: a self-referencing loop
    g.addDirectedEdge('M', 'N', { distance: 50 });
    g.addDirectedEdge('N', 'M', { distance: 50 });
    // Isolated node (singleton SCC)
    g.addNode('Orphan');

    const scc = extractLargestSCC(g);
    expect(scc.order).toBe(2);
    expect(scc.hasNode('Orphan')).toBe(false);
    expect(scc.size).toBe(2); // both M→N and N→M edges preserved
  });
});

// ---------------------------------------------------------------------------
// Suite 4 – buildBaseData  (OSM → graph edges)
// ---------------------------------------------------------------------------

/**
 * buildBaseData parses raw Overpass API JSON (which contains nodes and ways)
 * into a flat list of directed BaseEdge objects. Each BaseEdge corresponds to
 * one consecutive pair of OSM nodes in a road "way".
 *
 * Key responsibilities:
 * - Parse OSM node positions from the element list
 * - For each road "way", iterate consecutive node pairs and compute their
 *   Haversine distance
 * - Mark each edge as `isTarget = true` if its midpoint (or endpoints) falls
 *   inside / near the user-drawn polygon
 * - Respect the `oneway` OSM tag for bike mode (walk ignores it)
 */
describe('buildBaseData (OSM → base edges)', () => {
  // A small polygon near (0, 0)
  const polygon = [
    { lat: -0.01, lng: -0.01 },
    { lat: -0.01, lng:  0.01 },
    { lat:  0.01, lng:  0.01 },
    { lat:  0.01, lng: -0.01 },
  ];

  it('returns a nodes map and a baseEdges array', () => {
    const overpassData = makeMinimalOverpassData(polygon);
    const { nodes, baseEdges } = buildBaseData(overpassData, 'bike', polygon);
    expect(nodes).toBeInstanceOf(Map);
    expect(Array.isArray(baseEdges)).toBe(true);
  });

  it('creates one edge per consecutive node pair in a way', () => {
    // way with 3 nodes → 2 segments
    const overpassData = {
      elements: [
        { type: 'node', id: 1, lat: 0, lon: 0 },
        { type: 'node', id: 2, lat: 0.001, lon: 0 },
        { type: 'node', id: 3, lat: 0.002, lon: 0 },
        { type: 'way', id: 10, nodes: [1, 2, 3], tags: {} },
      ],
    };
    const { baseEdges } = buildBaseData(overpassData, 'bike', polygon);
    // 2 segments from 3-node way
    expect(baseEdges).toHaveLength(2);
  });

  it('edges inside the polygon are flagged as isTarget = true', () => {
    const overpassData = {
      elements: [
        { type: 'node', id: 1, lat: 0, lon: 0 },        // inside polygon
        { type: 'node', id: 2, lat: 0.001, lon: 0 },    // inside polygon
        { type: 'way', id: 10, nodes: [1, 2], tags: {} },
      ],
    };
    const { baseEdges } = buildBaseData(overpassData, 'bike', polygon);
    expect(baseEdges[0].isTarget).toBe(true);
  });

  it('edges far outside the polygon are flagged isTarget = false', () => {
    const farPolygon = [
      { lat: 50, lng: 10 },
      { lat: 50, lng: 11 },
      { lat: 51, lng: 11 },
      { lat: 51, lng: 10 },
    ];
    const overpassData = {
      elements: [
        { type: 'node', id: 1, lat: 0, lon: 0 },     // far from farPolygon
        { type: 'node', id: 2, lat: 0.001, lon: 0 },
        { type: 'way', id: 10, nodes: [1, 2], tags: {} },
      ],
    };
    const { baseEdges } = buildBaseData(overpassData, 'bike', farPolygon);
    expect(baseEdges[0].isTarget).toBe(false);
  });

  it('oneway=yes is respected for bike mode', () => {
    const overpassData = {
      elements: [
        { type: 'node', id: 1, lat: 0, lon: 0 },
        { type: 'node', id: 2, lat: 0.001, lon: 0 },
        { type: 'way', id: 10, nodes: [1, 2], tags: { oneway: 'yes' } },
      ],
    };
    const { baseEdges } = buildBaseData(overpassData, 'bike', polygon);
    expect(baseEdges[0].isOneway).toBe(true);
  });

  it('oneway=yes is IGNORED for walk mode', () => {
    const overpassData = {
      elements: [
        { type: 'node', id: 1, lat: 0, lon: 0 },
        { type: 'node', id: 2, lat: 0.001, lon: 0 },
        { type: 'way', id: 10, nodes: [1, 2], tags: { oneway: 'yes' } },
      ],
    };
    const { baseEdges } = buildBaseData(overpassData, 'walk', polygon);
    // Walk mode always treats streets as bidirectional
    expect(baseEdges[0].isOneway).toBe(false);
  });

  it('edges whose nodes are missing from the node list are silently skipped', () => {
    const overpassData = {
      elements: [
        { type: 'node', id: 1, lat: 0, lon: 0 },
        // node id 2 intentionally missing
        { type: 'way', id: 10, nodes: [1, 2], tags: {} },
      ],
    };
    const { baseEdges } = buildBaseData(overpassData, 'bike', polygon);
    expect(baseEdges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 – hierholzer  (Eulerian Circuit extraction)
// ---------------------------------------------------------------------------

/**
 * Hierholzer's algorithm finds an Eulerian circuit in a directed graph — a
 * closed walk that traverses every edge exactly once.
 *
 * Precondition: every node must have equal in-degree and out-degree (Eulerian
 * graph). The MCPP solver ensures this before calling hierholzer.
 *
 * The algorithm works by:
 * 1. Starting at any node with edges
 * 2. Following edges greedily until returning to the start (sub-circuit)
 * 3. Merging sub-circuits together until all edges are exhausted
 *
 * Result: an ordered array of node IDs representing the circuit.
 * The first and last node IDs are the same (closed circuit).
 */
describe('hierholzer (Eulerian Circuit)', () => {
  it('returns [] for an empty graph (no nodes)', () => {
    const g = new CustomMultiGraph();
    expect(hierholzer(g)).toEqual([]);
  });

  it('returns [] for a graph with nodes but zero edges', () => {
    const g = new CustomMultiGraph();
    g.addNode('A');
    g.addNode('B');
    expect(hierholzer(g)).toEqual([]);
  });

  it('simple 2-node cycle (A→B, B→A) produces a 3-element circuit [A,B,A]', () => {
    // The circuit visits each edge once and must return to start, so
    // a 2-edge cycle → [start, other, start] = 3 elements
    const g = new CustomMultiGraph();
    g.addNode('A', { lat: 0, lon: 0 });
    g.addNode('B', { lat: 1, lon: 0 });
    g.addDirectedEdge('A', 'B', { distance: 100 });
    g.addDirectedEdge('B', 'A', { distance: 100 });

    const circuit = hierholzer(g);
    expect(circuit).toHaveLength(3);
    // First and last node must be the same (closed circuit)
    expect(circuit[0]).toBe(circuit[circuit.length - 1]);
    // All three nodes of the cycle must appear
    expect(circuit).toContain('A');
    expect(circuit).toContain('B');
  });

  it('triangle cycle (A→B→C→A) produces a 4-element closed circuit', () => {
    // 3 directed edges → 3-step walk → 4 nodes in the circuit array
    // (last element == first element to "close" the loop)
    const g = makeTriangleCycleGraph();
    const circuit = hierholzer(g);

    expect(circuit).toHaveLength(4);
    expect(circuit[0]).toBe(circuit[circuit.length - 1]);
    expect(new Set(circuit).size).toBe(3); // exactly 3 distinct nodes
  });

  it('circuit with parallel edges — all edges are traversed', () => {
    // Two parallel A→B edges and two B→A edges → 4 total edges
    // → circuit of length 5
    const g = new CustomMultiGraph();
    g.addNode('A', { lat: 0, lon: 0 });
    g.addNode('B', { lat: 1, lon: 0 });
    g.addDirectedEdge('A', 'B', { distance: 10 });
    g.addDirectedEdge('A', 'B', { distance: 10 }); // parallel
    g.addDirectedEdge('B', 'A', { distance: 10 });
    g.addDirectedEdge('B', 'A', { distance: 10 }); // parallel

    const circuit = hierholzer(g);
    // 4 edges → circuit has 5 stops
    expect(circuit).toHaveLength(5);
    expect(circuit[0]).toBe(circuit[circuit.length - 1]);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 – solveMCPPAndBuildEulerianGraph  (MCPP Solver)
// ---------------------------------------------------------------------------

/**
 * The Mixed Chinese Postman Problem (MCPP) solver takes a strongly connected
 * subgraph and adds the minimum number of extra edge traversals so that every
 * node ends up with equal in-degree and out-degree (Eulerian condition).
 *
 * For small graphs (≤ 1 000 edges) it uses an LP solver (exact solution).
 * For larger graphs it falls back to a greedy heuristic.
 *
 * What we verify:
 * - The Eulerian graph it produces is non-empty when there are target edges
 * - The result is a CustomMultiGraph (same API)
 * - Every node in the result has in-degree == out-degree (Eulerian invariant)
 */
describe('solveMCPPAndBuildEulerianGraph (MCPP → Eulerian Graph)', () => {
  /**
   * Build the smallest possible meaningful scenario:
   * Two nodes connected bidirectionally, with one direction marked "target".
   * The solver must add the reverse traversal to balance degrees.
   */
  it('produces a non-empty Eulerian graph from a simple bidirectional edge', () => {
    const nodes = new Map<number, any>([
      [1, { lat: 0, lon: 0 }],
      [2, { lat: 0.001, lon: 0 }],
    ]);

    // Build a minimal SCC graph (bidirectional A ↔ B)
    const scc = new CustomMultiGraph();
    scc.addNode('1', { lat: 0, lon: 0 });
    scc.addNode('2', { lat: 0.001, lon: 0 });
    scc.addDirectedEdge('1', '2', { distance: 100, id: '10' });
    scc.addDirectedEdge('2', '1', { distance: 100, id: '10' });

    const baseEdges: BaseEdge[] = [
      { id: '10', u: '1', v: '2', dist: 100, isTarget: true, isOneway: false },
    ];

    const eulerGraph = solveMCPPAndBuildEulerianGraph(nodes, scc, baseEdges, 'bike');

    expect(eulerGraph).toBeInstanceOf(CustomMultiGraph);
    expect(eulerGraph.order).toBeGreaterThan(0);
    expect(eulerGraph.size).toBeGreaterThan(0);
  });

  it('every node in the resulting Eulerian graph has in-degree == out-degree', () => {
    // Triangle SCC where all edges are required (isTarget=true)
    const nodes = new Map<number, any>([
      [1, { lat: 0,    lon: 0 }],
      [2, { lat: 1,    lon: 0 }],
      [3, { lat: 0.5,  lon: 1 }],
    ]);

    const scc = new CustomMultiGraph();
    scc.addNode('1', nodes.get(1)); scc.addNode('2', nodes.get(2)); scc.addNode('3', nodes.get(3));
    // Bidirectional edges (3 pairs) to ensure strong connectivity
    scc.addDirectedEdge('1', '2', { distance: 50, id: 'e1' });
    scc.addDirectedEdge('2', '1', { distance: 50, id: 'e1' });
    scc.addDirectedEdge('2', '3', { distance: 50, id: 'e2' });
    scc.addDirectedEdge('3', '2', { distance: 50, id: 'e2' });
    scc.addDirectedEdge('3', '1', { distance: 50, id: 'e3' });
    scc.addDirectedEdge('1', '3', { distance: 50, id: 'e3' });

    const baseEdges: BaseEdge[] = [
      { id: 'e1', u: '1', v: '2', dist: 50, isTarget: true, isOneway: false },
      { id: 'e2', u: '2', v: '3', dist: 50, isTarget: true, isOneway: false },
      { id: 'e3', u: '3', v: '1', dist: 50, isTarget: true, isOneway: false },
    ];

    const eulerGraph = solveMCPPAndBuildEulerianGraph(nodes, scc, baseEdges, 'bike');

    // Verify the Eulerian invariant: in-degree == out-degree for every node
    eulerGraph.forEachNode((nodeId: string) => {
      const inD = eulerGraph.inDegree(nodeId);
      const outD = eulerGraph.outDegree(nodeId);
      expect(inD).toBe(outD);
    });
  });

  it('returns an empty graph when there are no target edges', () => {
    const nodes = new Map<number, any>([
      [1, { lat: 0, lon: 0 }],
      [2, { lat: 1, lon: 0 }],
    ]);
    const scc = new CustomMultiGraph();
    scc.addDirectedEdge('1', '2', { distance: 100 });
    scc.addDirectedEdge('2', '1', { distance: 100 });

    const baseEdges: BaseEdge[] = [
      { id: '10', u: '1', v: '2', dist: 100, isTarget: false, isOneway: false },
    ];

    const eulerGraph = solveMCPPAndBuildEulerianGraph(nodes, scc, baseEdges, 'bike');
    // No required edges → nothing to traverse → empty result
    expect(eulerGraph.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 7 – Full Pipeline Integration (fixture-driven)
// ---------------------------------------------------------------------------

/**
 * These integration tests run the entire optimizer pipeline end-to-end on
 * real OSM data captured from production sessions (stored as JSON fixtures).
 *
 * Each fixture contains:
 *   { polygon, mode, overpassData }
 *
 * A valid result must satisfy:
 *   1. The final circuit is non-empty (route was generated)
 *   2. The circuit is closed: first node ID == last node ID
 *   3. Every consecutive pair in the circuit shares a directed edge in the
 *      Eulerian graph (no "teleportation")
 */
describe('Full Pipeline Integration (fixtures)', () => {
  const runFixture = (fixtureName: string) => {
    const fixturePath = path.resolve(__dirname, 'fixtures', fixtureName);

    if (!fs.existsSync(fixturePath)) {
      console.warn(`⚠️  Fixture "${fixtureName}" not found – test skipped.`);
      return null;
    }

    const { polygon, mode, overpassData } = JSON.parse(
      fs.readFileSync(fixturePath, 'utf8')
    );

    // Step 2 – parse OSM data into base edges
    const { nodes, baseEdges } = buildBaseData(overpassData, mode, polygon);
    if (baseEdges.length === 0) return null;

    // Step 3 – extract largest SCC (bidirectional check graph)
    const sccCheckGraph = new CustomMultiGraph();
    baseEdges.forEach(edge => {
      sccCheckGraph.addNode(edge.u, nodes.get(Number(edge.u)));
      sccCheckGraph.addNode(edge.v, nodes.get(Number(edge.v)));
      sccCheckGraph.addDirectedEdge(edge.u, edge.v, { distance: edge.dist, id: edge.id });
      sccCheckGraph.addDirectedEdge(edge.v, edge.u, { distance: edge.dist, id: edge.id });
    });
    const sccGraph = extractLargestSCC(sccCheckGraph);
    if (sccGraph.order === 0) return null;

    // Step 4 – solve MCPP → Eulerian graph
    const eulerGraph = solveMCPPAndBuildEulerianGraph(nodes, sccGraph, baseEdges, mode);

    // Step 5 – extract Eulerian circuit
    const circuit = hierholzer(eulerGraph);

    return { circuit, eulerGraph };
  };

  it('works.json – produces a valid closed circuit', () => {
    const result = runFixture('works.json');
    if (!result) return; // fixture missing → skip gracefully

    const { circuit, eulerGraph } = result;

    // 1. Circuit is non-empty
    expect(circuit.length).toBeGreaterThan(1);

    // 2. Circuit is closed: first and last node are the same
    expect(circuit[0]).toBe(circuit[circuit.length - 1]);

    // 3. Every step corresponds to a real directed edge (no teleportation)
    for (let i = 0; i < circuit.length - 1; i++) {
      const u = circuit[i];
      const v = circuit[i + 1];
      expect(
        eulerGraph.hasDirectedEdge(u, v),
        `Missing edge ${u} → ${v} at step ${i}`
      ).toBe(true);
    }
  }, 60_000); // generous timeout for the LP solver

  it('not-work.json – produces a valid closed circuit', () => {
    const result = runFixture('not-work.json');
    if (!result) return;

    const { circuit, eulerGraph } = result;

    expect(circuit.length).toBeGreaterThan(1);
    expect(circuit[0]).toBe(circuit[circuit.length - 1]);

    for (let i = 0; i < circuit.length - 1; i++) {
      const u = circuit[i];
      const v = circuit[i + 1];
      expect(eulerGraph.hasDirectedEdge(u, v)).toBe(true);
    }
  }, 60_000);
});
