import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { 
  buildBaseData, 
  extractLargestSCC, 
  solveMCPPAndBuildEulerianGraph, 
  hierholzer,
  CustomMultiGraph
} from '../src/workers/optimizer.worker';

describe('Optimizer Pipeline', () => {
  it('should process a test fixture correctly if available', () => {
    const fixturePath = path.resolve(__dirname, 'fixture.json');
    
    if (!fs.existsSync(fixturePath)) {
      console.warn('⚠️ Nenhum fixture.json encontrado. Teste pulado.');
      console.warn('Salve um arquivo de debug na UI e renomeie para fixture.json dentro da pasta tests/ para testar offline.');
      expect(true).toBe(true);
      return;
    }

    const rawData = fs.readFileSync(fixturePath, 'utf8');
    const { polygon, mode, overpassData } = JSON.parse(rawData);

    expect(polygon).toBeDefined();
    expect(overpassData).toBeDefined();

    console.time('Step 2: buildBaseData');
    const { nodes, baseEdges } = buildBaseData(overpassData, mode, polygon);
    console.timeEnd('Step 2: buildBaseData');
    expect(nodes.size).toBeGreaterThan(0);

    const sccCheckGraph = new CustomMultiGraph();
    baseEdges.forEach(edge => {
      sccCheckGraph.addNode(edge.u, nodes.get(Number(edge.u)));
      sccCheckGraph.addNode(edge.v, nodes.get(Number(edge.v)));
      sccCheckGraph.addDirectedEdge(edge.u, edge.v, {});
      sccCheckGraph.addDirectedEdge(edge.v, edge.u, {});
    });

    console.time('Step 3: extractLargestSCC');
    const sccGraph = extractLargestSCC(sccCheckGraph);
    console.timeEnd('Step 3: extractLargestSCC');
    expect(sccGraph.order).toBeGreaterThan(0);

    console.time('Step 4: solveMCPP');
    const eulerGraph = solveMCPPAndBuildEulerianGraph(nodes, sccGraph, baseEdges, mode);
    console.timeEnd('Step 4: solveMCPP');
    expect(eulerGraph.order).toBeGreaterThan(0);

    console.time('Step 5: hierholzer');
    const circuitNodeIds = hierholzer(eulerGraph);
    console.timeEnd('Step 5: hierholzer');
    expect(circuitNodeIds.length).toBeGreaterThan(0);
    
    console.log(`Rota final tem ${circuitNodeIds.length} nós.`);
  });
});
