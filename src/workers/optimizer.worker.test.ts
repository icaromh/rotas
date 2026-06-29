/**
 * optimizer.worker.test.ts
 *
 * Unit tests for Issue #11 — Walk boundary sticking.
 *
 * We test:
 *  1. isPointInPolygon — the ray-casting utility that drives all polygon checks.
 *  2. buildBaseData    — that walk mode disables oneway flags.
 *  3. solveMCPPAndBuildEulerianGraph — that in walk mode every node in the
 *     resulting Eulerian graph lies inside (or on the boundary of) the polygon.
 */

import { describe, it, expect } from 'vitest';
import {
  isPointInPolygon,
  buildBaseData,
  solveMCPPAndBuildEulerianGraph,
  CustomMultiGraph,
  extractLargestSCC,
  hierholzer,
} from './optimizer.worker';

// ---------------------------------------------------------------------------
// 1. isPointInPolygon
// ---------------------------------------------------------------------------

describe('isPointInPolygon', () => {
  // Simple unit square: (0,0) → (1,0) → (1,1) → (0,1)
  const square = [
    { lat: 0, lng: 0 },
    { lat: 1, lng: 0 },
    { lat: 1, lng: 1 },
    { lat: 0, lng: 1 },
  ];

  it('returns true for a point clearly inside the polygon', () => {
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, square)).toBe(true);
  });

  it('returns false for a point clearly outside the polygon', () => {
    expect(isPointInPolygon({ lat: 2, lng: 2 }, square)).toBe(false);
  });

  it('returns false for a point on the negative side', () => {
    expect(isPointInPolygon({ lat: -1, lng: -1 }, square)).toBe(false);
  });

  it('returns true for a point near the center of a larger polygon', () => {
    const triangle = [
      { lat: 0, lng: 0 },
      { lat: 10, lng: 0 },
      { lat: 5, lng: 10 },
    ];
    expect(isPointInPolygon({ lat: 5, lng: 3 }, triangle)).toBe(true);
  });

  it('returns false for a point outside a triangle', () => {
    const triangle = [
      { lat: 0, lng: 0 },
      { lat: 10, lng: 0 },
      { lat: 5, lng: 10 },
    ];
    expect(isPointInPolygon({ lat: 0, lng: 9 }, triangle)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. buildBaseData — walk vs bike oneway handling
// ---------------------------------------------------------------------------

describe('buildBaseData', () => {
  /** Minimal OSM-style overpass fixture with one oneway road */
  const overpassData = {
    elements: [
      { type: 'node', id: 1, lat: 0.5, lon: 0.5 },
      { type: 'node', id: 2, lat: 0.5, lon: 0.6 },
      {
        type: 'way',
        id: 100,
        nodes: [1, 2],
        tags: { oneway: 'yes', highway: 'residential' },
      },
    ],
  };

  // Polygon large enough to contain all nodes
  const polygon = [
    { lat: 0, lng: 0 },
    { lat: 1, lng: 0 },
    { lat: 1, lng: 1 },
    { lat: 0, lng: 1 },
  ];

  it('marks edges as oneway=true in bike mode when OSM tag says yes', () => {
    const { baseEdges } = buildBaseData(overpassData, 'bike', polygon, 50);
    expect(baseEdges.length).toBeGreaterThan(0);
    expect(baseEdges[0].isOneway).toBe(true);
  });

  it('marks ALL edges as oneway=false in walk mode regardless of OSM tag', () => {
    const { baseEdges } = buildBaseData(overpassData, 'walk', polygon, 50);
    expect(baseEdges.length).toBeGreaterThan(0);
    expect(baseEdges[0].isOneway).toBe(false);
  });

  it('correctly computes distances > 0 for adjacent nodes', () => {
    const { baseEdges } = buildBaseData(overpassData, 'walk', polygon, 50);
    expect(baseEdges[0].dist).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Walk-mode route boundary containment
// ---------------------------------------------------------------------------

describe('solveMCPPAndBuildEulerianGraph — walk mode boundary sticking', () => {
  /**
   * Build a tiny grid of 4 nodes inside a unit-square polygon.
   * Add a 5th node that is clearly OUTSIDE the polygon.
   * In bike mode, the deadhead solver is free to route through the outside node.
   * In walk mode, it should heavily penalise the outside node and keep the
   * route inside the polygon.
   *
   * Graph layout (lat, lng):
   *   A(0.1,0.1) — B(0.1,0.9)
   *       |               |
   *   C(0.9,0.1) — D(0.9,0.9)
   *
   * Outside node:
   *   E(2.0, 2.0) — connected to A and D with short edges (shortcut that would
   *   attract the deadhead solver if not penalised)
   */

  const polygon = [
    { lat: 0, lng: 0 },
    { lat: 1, lng: 0 },
    { lat: 1, lng: 1 },
    { lat: 0, lng: 1 },
  ];

  // Nodes map (id → OSM-style node)
  const nodesMap = new Map<number, any>([
    [1, { id: 1, lat: 0.1, lon: 0.1 }], // A — inside
    [2, { id: 2, lat: 0.1, lon: 0.9 }], // B — inside
    [3, { id: 3, lat: 0.9, lon: 0.1 }], // C — inside
    [4, { id: 4, lat: 0.9, lon: 0.9 }], // D — inside
    [5, { id: 5, lat: 2.0, lon: 2.0 }], // E — OUTSIDE
  ]);

  // Helper to compute approximate haversine-like distance (just Euclidean for tests)
  const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
    Math.sqrt((a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2) * 111000; // rough meters

  // Build base edges: ring A-B-D-C-A + diagonals A-D (all isTarget=true)
  // Plus shortcuts via the outside node E→A and E→D (short, attractive for deadhead)
  const baseEdges = [
    // Inside ring
    { id: '1', u: '1', v: '2', dist: dist(nodesMap.get(1), nodesMap.get(2)), isOneway: false, isTarget: true },
    { id: '2', u: '2', v: '4', dist: dist(nodesMap.get(2), nodesMap.get(4)), isOneway: false, isTarget: true },
    { id: '3', u: '4', v: '3', dist: dist(nodesMap.get(4), nodesMap.get(3)), isOneway: false, isTarget: true },
    { id: '4', u: '3', v: '1', dist: dist(nodesMap.get(3), nodesMap.get(1)), isOneway: false, isTarget: true },
    // Short "shortcut" edges through outside node E — very short (1m) to attract deadhead
    { id: '5', u: '1', v: '5', dist: 1, isOneway: false, isTarget: false },
    { id: '6', u: '5', v: '4', dist: 1, isOneway: false, isTarget: false },
  ];

  /** Build a fully-connected SCC graph from the base edges */
  function buildSCCGraph() {
    const g = new CustomMultiGraph();
    for (const e of baseEdges) {
      g.addNode(e.u, nodesMap.get(Number(e.u)));
      g.addNode(e.v, nodesMap.get(Number(e.v)));
      g.addDirectedEdge(e.u, e.v, { distance: e.dist, id: e.id });
      g.addDirectedEdge(e.v, e.u, { distance: e.dist, id: e.id });
    }
    return extractLargestSCC(g);
  }

  it('in walk mode, the Eulerian graph nodes are ALL inside (or on border of) the polygon', () => {
    const sccGraph = buildSCCGraph();
    const eulerGraph = solveMCPPAndBuildEulerianGraph(
      nodesMap,
      sccGraph,
      baseEdges,
      'walk',
      polygon,
    );

    const outsideNodes: string[] = [];
    eulerGraph.forEachNode((nodeId) => {
      // Only check nodes that actually participate in edges
      if (eulerGraph.outDegree(nodeId) === 0 && eulerGraph.inDegree(nodeId) === 0) return;
      const attr = eulerGraph.getNodeAttributes(nodeId);
      if (!attr) return;
      const inside = isPointInPolygon({ lat: attr.lat, lng: attr.lon }, polygon);
      // Allow nodes very close to the boundary (buffer 0.05 degrees)
      if (!inside) {
        const onBoundary = [
          { lat: 0, lng: 0 },
          { lat: 1, lng: 0 },
          { lat: 1, lng: 1 },
          { lat: 0, lng: 1 },
        ].some(
          (corner) =>
            Math.abs(attr.lat - corner.lat) < 0.05 && Math.abs(attr.lon - corner.lng) < 0.05,
        );
        if (!onBoundary) outsideNodes.push(nodeId);
      }
    });

    expect(outsideNodes).toHaveLength(0);
  });

  it('in bike mode, the solver is allowed to use the outside-node shortcut (no polygon constraint)', () => {
    // This test documents that WITHOUT the walk-mode constraint the outside node CAN appear.
    // We do NOT assert it MUST appear (the LP solver may still not need it), but we assert
    // that isPointInPolygon correctly identifies node 5 as outside.
    const outsideNode = nodesMap.get(5);
    expect(isPointInPolygon({ lat: outsideNode.lat, lng: outsideNode.lon }, polygon)).toBe(false);
  });

  it('produces a non-empty Eulerian circuit in walk mode', () => {
    const sccGraph = buildSCCGraph();
    const eulerGraph = solveMCPPAndBuildEulerianGraph(
      nodesMap,
      sccGraph,
      baseEdges,
      'walk',
      polygon,
    );
    const circuit = hierholzer(eulerGraph);
    expect(circuit.length).toBeGreaterThan(0);
  });
});
