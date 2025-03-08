// pathfinding.js
import { metroWaitTime, walkingSpeed, maxSpeed } from "./constants.js";
import { distance } from "./utils.js";
import { computeTravelTime } from "./utils.js";

// The gridNodes object is assumed to be created in main.js and passed in.
export function buildRoadGraph(gridNodes, metroLines) {
  let graph = {};
  for (let key in gridNodes) {
    graph[key] = [];
  }
  // Walking edges:
  for (let key in gridNodes) {
    let node = gridNodes[key];
    let neighbors = [
      { col: node.col + 1, row: node.row },
      { col: node.col - 1, row: node.row },
      { col: node.col, row: node.row + 1 },
      { col: node.col, row: node.row - 1 },
    ];
    neighbors.forEach((n) => {
      let nKey = n.col + "," + n.row;
      if (gridNodes[nKey]) {
        let d = distance(node.x, node.y, gridNodes[nKey].x, gridNodes[nKey].y);
        graph[key].push({
          from: node,
          to: gridNodes[nKey],
          mode: "walk",
          cost: d / walkingSpeed,
        });
      }
    });
  }
  // Metro edges:
  metroLines.forEach((line) => {
    for (let i = 0; i < line.stations.length - 1; i++) {
      let a = line.stations[i],
        b = line.stations[i + 1];
      let keyA = a.col + "," + a.row;
      let keyB = b.col + "," + b.row;
      if (gridNodes[keyA] && gridNodes[keyB]) {
        let d = distance(a.x, a.y, b.x, b.y);
        let totalDistance = 0;
        for (let j = 0; j < line.stations.length - 1; j++) {
          totalDistance += distance(
            line.stations[j].x,
            line.stations[j].y,
            line.stations[j + 1].x,
            line.stations[j + 1].y
          );
        }
        let numTrains =
          line.trains && line.trains.length ? line.trains.length : 1;
        let waitingTime = (2 * totalDistance) / (numTrains * maxSpeed);
        let metroCost = d / maxSpeed + waitingTime;
        graph[keyA].push({
          from: a,
          to: b,
          mode: "metro",
          cost: metroCost,
          line,
        });
        graph[keyB].push({
          from: b,
          to: a,
          mode: "metro",
          cost: metroCost,
          line,
        });
      }
    }
  });
  return graph;
}

export function computeFastestRoute(
  gridNodes,
  metroLines,
  startNode,
  goalNode
) {
  let graph = buildRoadGraph(gridNodes, metroLines);
  let startKey = startNode.col + "," + startNode.row;
  let goalKey = goalNode.col + "," + goalNode.row;
  let dist = {};
  let prev = {};
  for (let key in graph) {
    dist[key] = Infinity;
  }
  dist[startKey] = 0;
  let pq = [{ key: startKey, cost: 0 }];
  while (pq.length) {
    pq.sort((a, b) => a.cost - b.cost);
    let current = pq.shift();
    if (current.key === goalKey) break;
    graph[current.key].forEach((edge) => {
      let neighborKey = edge.to.col + "," + edge.to.row;
      let alt = dist[current.key] + edge.cost;
      if (alt < dist[neighborKey]) {
        dist[neighborKey] = alt;
        prev[neighborKey] = { from: current.key, edge };
        pq.push({ key: neighborKey, cost: alt });
      }
    });
  }
  let route = [];
  let curKey = goalKey;
  while (curKey && curKey !== startKey) {
    if (prev[curKey]) {
      route.unshift(prev[curKey].edge);
      curKey = prev[curKey].from;
    } else {
      break;
    }
  }
  return route;
}
