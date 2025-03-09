// commuters.js
import { distance } from "./utils.js";
import { walkingSpeed, transferTime } from "./constants.js";
import { computeFastestRoute } from "./pathfinding.js";
import { arrivalEffects } from "./globals.js";
import { getNextStop } from "./trains.js";

export function spawnCommuter(
  gridNodes,
  metroLines,
  commuters,
  nextCommuterIdObj
) {
  let gridKeys = Object.keys(gridNodes);
  if (gridKeys.length < 2) return;
  let startKey = gridKeys[Math.floor(Math.random() * gridKeys.length)];
  let goalKey;
  do {
    goalKey = gridKeys[Math.floor(Math.random() * gridKeys.length)];
  } while (goalKey === startKey);
  let startNode = gridNodes[startKey];
  let goalNode = gridNodes[goalKey];
  let route = computeFastestRoute(gridNodes, metroLines, startNode, goalNode);
  if (!route || route.length === 0) {
    return;
  }
  let commuter = {
    id: nextCommuterIdObj.value++,
    startNode,
    goalNode,
    destinationStation: goalNode,
    route,
    currentEdgeIndex: 0,
    progress: 0,
    state: "walking",
    position: { x: startNode.x, y: startNode.y },
    lastUpdate: performance.now(),
    targetStop: null,
    transferStart: null,
  };
  commuters.push(commuter);
}

/**
 * Recalculates routes for each commuter.
 * @param {Array} commuters - The array of commuter objects.
 * @param {Object} gridNodes - The grid nodes object, with keys like "col,row" and values with x,y.
 * @param {Array} metroLines - The current metro lines (for metro edge costs).
 */
export function recalculateRoutes(commuters, gridNodes, metroLines) {
  commuters.forEach((commuter) => {
    // Only recalc for commuters in walking or waiting states.
    if (commuter.state === "walking" || commuter.state === "waitingForTrain") {
      // Find the closest grid node to the commuter's current position.
      let bestDistance = Infinity;
      let startNode = null;
      for (let key in gridNodes) {
        const node = gridNodes[key];
        const d = distance(
          commuter.position.x,
          commuter.position.y,
          node.x,
          node.y
        );
        if (d < bestDistance) {
          bestDistance = d;
          startNode = node;
        }
      }
      if (startNode && commuter.goalNode) {
        // Compute a new route from the start node to the commuter's goal.
        const newRoute = computeFastestRoute(
          gridNodes,
          metroLines,
          startNode,
          commuter.goalNode
        );
        commuter.route = newRoute;
        commuter.currentEdgeIndex = 0;
      }
    }
  });
}

export function updateCommuters(commuters, metroLines, gridNodes, now) {
  function setTargetStop(commuter) {
    let edge = commuter.route[commuter.currentEdgeIndex];
    if (edge.mode !== "metro") return;
    let target = edge.to;
    let i = commuter.currentEdgeIndex;
    let line = edge.line;
    while (
      i < commuter.route.length &&
      commuter.route[i].mode === "metro" &&
      commuter.route[i].line === line
    ) {
      target = commuter.route[i].to;
      i++;
    }
    commuter.targetStop = target;
  }

  commuters.forEach((commuter) => {
    if (commuter.state === "riding") {
      return;
    } else if (commuter.state === "transferring") {
      if (now - commuter.transferStart >= transferTime) {
        commuter.state = "waitingForTrain";
      }
      commuter.lastUpdate = now;
      return;
    } else if (commuter.state === "walking") {
      if (
        !commuter.route ||
        commuter.currentEdgeIndex >= commuter.route.length
      ) {
        commuter.arrived = true;
        return;
      }
      let edge = commuter.route[commuter.currentEdgeIndex];
      if (edge.mode === "walk") {
        let d = distance(
          edge.to.x,
          edge.to.y,
          commuter.position.x,
          commuter.position.y
        );
        if (d < walkingSpeed) {
          commuter.position = { x: edge.to.x, y: edge.to.y };
          commuter.currentEdgeIndex++;
        } else {
          let dx = edge.to.x - commuter.position.x,
            dy = edge.to.y - commuter.position.y;
          let normalized_dx = dx / d,
            normalized_dy = dy / d;
          commuter.position = {
            x: commuter.position.x + normalized_dx * walkingSpeed,
            y: commuter.position.y + normalized_dy * walkingSpeed,
          };
        }
      } else if (edge.mode === "metro") {
        setTargetStop(commuter);
        commuter.state = "waitingForTrain";
        commuter.position = { x: edge.from.x, y: edge.from.y };
      }
      commuter.lastUpdate = now;
    } else if (commuter.state === "waitingForTrain") {
      if (
        !commuter.route ||
        commuter.currentEdgeIndex >= commuter.route.length
      ) {
        commuter.arrived = true;
        return;
      }
      let edge = commuter.route[commuter.currentEdgeIndex];
      if (!commuter.targetStop && edge.mode === "metro") {
        setTargetStop(commuter);
        commuter.position = { x: edge.from.x, y: edge.from.y };
      }
      if (!edge.line) return;
      let candidate = edge.line.trains.find((train) => {
        if (train.state !== "dwell") return false;
        return getNextStop(train) === edge.to;
      });
      if (candidate) {
        commuter.state = "riding";
        candidate.onboard = candidate.onboard || [];
        candidate.onboard.push(commuter);
      }
    }
  });
  // Remove arrived commuters:
  for (let i = commuters.length - 1; i >= 0; i--) {
    if (commuters[i].arrived) {
      arrivalEffects.push({
        x: commuters[i].position.x,
        y: commuters[i].position.y,
        startTime: now,
      });
      commuters.splice(i, 1);
    }
  }
}
