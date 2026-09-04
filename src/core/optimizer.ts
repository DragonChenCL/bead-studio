// @ts-nocheck
import { palette, deltaE00, summarizeUsage } from './color';

class Edge {
  constructor(to, reverse, capacity, cost) {
    this.to = to;
    this.reverse = reverse;
    this.capacity = capacity;
    this.original = capacity;
    this.cost = cost;
  }
}

function addEdge(graph, from, to, capacity, cost) {
  const forward = new Edge(to, graph[to].length, capacity, cost);
  const reverse = new Edge(from, graph[from].length, 0, -cost);
  graph[from].push(forward);
  graph[to].push(reverse);
  return forward;
}

function minCostFlow(demands, supplies, costFn) {
  const demandCount = demands.length;
  const supplyCount = supplies.length;
  const source = demandCount + supplyCount;
  const sink = source + 1;
  const nodeCount = sink + 1;
  const graph = Array.from({ length: nodeCount }, () => []);
  const pairEdges = Array.from({ length: demandCount }, () => Array(supplyCount));

  demands.forEach((demand, index) => addEdge(graph, source, index, demand.count, 0));
  for (let i = 0; i < demandCount; i += 1) {
    for (let j = 0; j < supplyCount; j += 1) {
      const raw = costFn(demands[i], supplies[j]);
      const cost = Math.round(raw * 100) + (demands[i].code === supplies[j].code ? 0 : 1);
      pairEdges[i][j] = addEdge(graph, i, demandCount + j, demands[i].count, cost);
    }
  }
  supplies.forEach((supply, index) => addEdge(graph, demandCount + index, sink, supply.count, 0));

  const targetFlow = demands.reduce((sum, row) => sum + row.count, 0);
  let flow = 0;

  while (flow < targetFlow) {
    const distance = Array(nodeCount).fill(Infinity);
    const previousNode = Array(nodeCount).fill(-1);
    const previousEdge = Array(nodeCount).fill(-1);
    const queued = Array(nodeCount).fill(false);
    const queue = [source];
    distance[source] = 0;
    queued[source] = true;

    for (let head = 0; head < queue.length; head += 1) {
      const node = queue[head];
      queued[node] = false;
      for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex += 1) {
        const edge = graph[node][edgeIndex];
        if (edge.capacity <= 0) continue;
        const nextDistance = distance[node] + edge.cost;
        if (nextDistance >= distance[edge.to]) continue;
        distance[edge.to] = nextDistance;
        previousNode[edge.to] = node;
        previousEdge[edge.to] = edgeIndex;
        if (!queued[edge.to]) {
          queued[edge.to] = true;
          queue.push(edge.to);
        }
      }
    }

    if (!Number.isFinite(distance[sink])) break;
    let add = targetFlow - flow;
    for (let node = sink; node !== source; node = previousNode[node]) {
      add = Math.min(add, graph[previousNode[node]][previousEdge[node]].capacity);
    }
    for (let node = sink; node !== source; node = previousNode[node]) {
      const edge = graph[previousNode[node]][previousEdge[node]];
      edge.capacity -= add;
      graph[node][edge.reverse].capacity += add;
    }
    flow += add;
  }

  const allocations = new Map();
  for (let i = 0; i < demandCount; i += 1) {
    const rows = [];
    for (let j = 0; j < supplyCount; j += 1) {
      const edge = pairEdges[i][j];
      const used = edge.original - edge.capacity;
      if (used > 0) {
        rows.push({
          target: supplies[j].code,
          count: used,
          deltaE: costFn(demands[i], supplies[j]),
        });
      }
    }
    allocations.set(demands[i].code, rows);
  }

  return { flow, targetFlow, allocations };
}

function componentOrder(cells, width, height, code) {
  const seen = new Uint8Array(cells.length);
  const components = [];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let start = 0; start < cells.length; start += 1) {
    if (seen[start] || cells[start] !== code) continue;
    const component = [];
    const queue = [start];
    seen[start] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      const x = current % width;
      const y = Math.floor(current / width);
      component.push(current);
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!seen[next] && cells[next] === code) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    components.push(component);
  }

  components.sort((a, b) => b.length - a.length);
  return components.flat();
}

export function optimizeToInventory(pattern, inventory) {
  const sourceCells = pattern.cells.slice();
  const usage = summarizeUsage(sourceCells);
  const totalNeed = usage.reduce((sum, row) => sum + row.count, 0);
  const supplies = palette
    .map((color) => ({
      code: color.code,
      color,
      count: Math.max(0, Math.floor(Number(inventory[color.code]) || 0)),
    }))
    .filter((row) => row.count > 0);
  const totalSupply = supplies.reduce((sum, row) => sum + row.count, 0);

  if (totalSupply < totalNeed) {
    return {
      ok: false,
      reason: 'TOTAL_INVENTORY_SHORT',
      totalNeed,
      totalSupply,
      missing: totalNeed - totalSupply,
    };
  }

  const demands = usage.map((row) => ({ code: row.code, count: row.count, color: row.color }));
  const result = minCostFlow(demands, supplies, (demand, supply) =>
    deltaE00(demand.color.lab, supply.color.lab),
  );
  if (result.flow < totalNeed) return { ok: false, reason: 'NO_FEASIBLE_ASSIGNMENT' };

  const cells = sourceCells.slice();
  const mapping = [];
  let changed = 0;
  let weightedDelta = 0;
  let maxDeltaE = 0;

  for (const demand of demands) {
    const order = componentOrder(sourceCells, pattern.width, pattern.height, demand.code);
    const allocations = (result.allocations.get(demand.code) || []).sort((a, b) => {
      if (a.target === demand.code && b.target !== demand.code) return -1;
      if (b.target === demand.code && a.target !== demand.code) return 1;
      return b.count - a.count;
    });
    let cursor = 0;
    for (const allocation of allocations) {
      for (let i = 0; i < allocation.count; i += 1) {
        cells[order[cursor]] = allocation.target;
        cursor += 1;
      }
      if (allocation.target !== demand.code) {
        changed += allocation.count;
        weightedDelta += allocation.count * allocation.deltaE;
        maxDeltaE = Math.max(maxDeltaE, allocation.deltaE);
        mapping.push({
          from: demand.code,
          to: allocation.target,
          count: allocation.count,
          deltaE: allocation.deltaE,
        });
      }
    }
  }

  const optimizedUsage = summarizeUsage(cells);
  const remaining = {};
  supplies.forEach((row) => { remaining[row.code] = row.count; });
  optimizedUsage.forEach((row) => { remaining[row.code] = (remaining[row.code] || 0) - row.count; });

  return {
    ok: true,
    pattern: { ...pattern, cells },
    mapping: mapping.sort((a, b) => b.count - a.count),
    changed,
    totalNeed,
    avgDeltaEChanged: changed ? weightedDelta / changed : 0,
    maxDeltaE,
    remaining,
    optimizedUsage,
  };
}

export function optimizeBalanced(pattern, inventory, options = {}) {
  const maxDeltaE = Math.max(0, Number(options.maxDeltaE) || 15);
  const packSize = Math.max(1, Math.floor(Number(options.packSize) || 1000));
  const base = {};
  palette.forEach((color) => {
    base[color.code] = Math.max(0, Math.floor(Number(inventory[color.code]) || 0));
  });

  const usage = summarizeUsage(pattern.cells);
  const virtual = { ...base };
  const totalNeed = usage.reduce((sum, row) => sum + row.count, 0);
  const totalStock = Object.values(base).reduce((sum, value) => sum + value, 0);
  let gap = Math.max(0, totalNeed - totalStock);

  for (const row of [...usage].sort((a, b) => b.count - a.count)) {
    if (!gap) break;
    const add = Math.min(gap, Math.max(0, row.count - (virtual[row.code] || 0)));
    virtual[row.code] = (virtual[row.code] || 0) + add;
    gap -= add;
  }

  let result = optimizeToInventory(pattern, virtual);
  if (!result.ok) return result;

  for (let round = 0; round < 10; round += 1) {
    const badMappings = (result.mapping || []).filter((row) => row.deltaE > maxDeltaE);
    if (!badMappings.length) break;
    let added = 0;
    for (const mapping of badMappings) {
      const demand = usage.find((row) => row.code === mapping.from)?.count || 0;
      const capacity = Math.max(0, demand - (virtual[mapping.from] || 0));
      const add = Math.min(capacity, mapping.count);
      if (add > 0) {
        virtual[mapping.from] = (virtual[mapping.from] || 0) + add;
        added += add;
      }
    }
    if (!added) break;
    result = optimizeToInventory(pattern, virtual);
    if (!result.ok) break;
  }

  if (!result.ok) return result;
  const purchase = [];
  let missing = 0;
  for (const row of summarizeUsage(result.pattern.cells)) {
    const count = Math.max(0, row.count - (base[row.code] || 0));
    if (count > 0) {
      purchase.push({ code: row.code, count, packs: Math.ceil(count / packSize) });
      missing += count;
    }
  }

  return {
    ...result,
    mode: 'balanced',
    maxDeltaE,
    purchase,
    purchaseBeads: missing,
    purchasePacks: purchase.reduce((sum, row) => sum + row.packs, 0),
    missing,
  };
}
