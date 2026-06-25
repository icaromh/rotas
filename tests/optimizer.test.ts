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
  const runFixture = (fixtureName: string) => {
    const fixturePath = path.resolve(__dirname, 'fixtures', fixtureName);
    
    if (!fs.existsSync(fixturePath)) {
      console.warn(`⚠️ Nenhum ${fixtureName} encontrado. Teste pulado.`);
      return;
    }

    console.log(`\n=== Running ${fixtureName} ===`);
    const rawData = fs.readFileSync(fixturePath, 'utf8');
    const { polygon, mode, overpassData } = JSON.parse(rawData);

    console.time(`[${fixtureName}] Step 2: buildBaseData`);
    const { nodes, baseEdges } = buildBaseData(overpassData, mode, polygon);
    console.timeEnd(`[${fixtureName}] Step 2: buildBaseData`);
    
    console.log(`[${fixtureName}] Base edges: ${baseEdges.length}`);

    const sccCheckGraph = new CustomMultiGraph();
    baseEdges.forEach(edge => {
      sccCheckGraph.addNode(edge.u, nodes.get(Number(edge.u)));
      sccCheckGraph.addNode(edge.v, nodes.get(Number(edge.v)));
      sccCheckGraph.addDirectedEdge(edge.u, edge.v, {});
      sccCheckGraph.addDirectedEdge(edge.v, edge.u, {});
    });

    console.time(`[${fixtureName}] Step 3: extractLargestSCC`);
    const sccGraph = extractLargestSCC(sccCheckGraph);
    console.timeEnd(`[${fixtureName}] Step 3: extractLargestSCC`);
    
    console.log(`[${fixtureName}] SCC nodes: ${sccGraph.order}`);

    console.time(`[${fixtureName}] Step 4: solveMCPP`);
    const eulerGraph = solveMCPPAndBuildEulerianGraph(nodes, sccGraph, baseEdges, mode);
    console.timeEnd(`[${fixtureName}] Step 4: solveMCPP`);

    console.time(`[${fixtureName}] Step 5: hierholzer`);
    const circuitNodeIds = hierholzer(eulerGraph);
    console.timeEnd(`[${fixtureName}] Step 5: hierholzer`);
    
    console.log(`[${fixtureName}] Rota final tem ${circuitNodeIds.length} nós.`);
  };

  it('should process works.json', () => {
    runFixture('works.json');
  });

  it('should process not-work.json', () => {
    runFixture('not-work.json');
  });
});
