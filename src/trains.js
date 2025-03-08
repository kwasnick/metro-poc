// trains.js
import { distance } from "./utils.js";
import { acceleration, maxSpeed, dwellTime } from "./constants.js";
import { computeTravelTime } from "./utils.js";

export function spawnDefaultTrains(line) {
  line.trains = [];
  let now = performance.now();
  if (!line.isLoop) {
    line.trains.push({
      id: Date.now(),
      line: line,
      direction: 1,
      currentSegment: 0,
      progress: 0,
      state: "dwell",
      dwellStart: now,
      travelTime: 0,
      onboard: [],
      originalSegment: null,
      position: { x: line.stations[0].x, y: line.stations[0].y }
    });
    line.trains.push({
      id: Date.now() + 1,
      line: line,
      direction: -1,
      currentSegment: line.stations.length - 2,
      progress: 0,
      state: "dwell",
      dwellStart: now,
      travelTime: 0,
      onboard: [],
      originalSegment: null,
      position: { x: line.stations[line.stations.length - 2].x, y: line.stations[line.stations.length - 2].y }
    });
  } else {
    line.trains.push({
      id: Date.now(),
      line: line,
      direction: 1,
      currentSegment: 0,
      progress: 0,
      state: "dwell",
      dwellStart: now,
      travelTime: 0,
      onboard: [],
      originalSegment: null,
      position: { x: line.stations[0].x, y: line.stations[0].y }
    });
    line.trains.push({
      id: Date.now() + 1,
      line: line,
      direction: -1,
      currentSegment: 0,
      progress: 0,
      state: "dwell",
      dwellStart: now,
      travelTime: 0,
      onboard: [],
      originalSegment: null,
      position: { x: line.stations[0].x, y: line.stations[0].y }
    });
  }
}

function offloadPassengers(train, now) {
  let line = train.line;
  let arrivalStation = train.originalSegment ? train.originalSegment.to : null;
  if (!arrivalStation) return;
  train.onboard.forEach(commuter => {
    if (commuter.route && commuter.route[commuter.currentEdgeIndex] && 
        commuter.route[commuter.currentEdgeIndex].mode === "metro" &&
        commuter.route[commuter.currentEdgeIndex].to.id === arrivalStation.id) {
      commuter.currentEdgeIndex += 1;
    }
    if (commuter.state === "riding" && commuter.targetStop && commuter.targetStop.id === arrivalStation.id) {
      commuter.targetStop = null;
      commuter.currentStation = arrivalStation;
      if (commuter.currentEdgeIndex >= commuter.route.length) {
        commuter.arrived = true;
      } else {
        commuter.position = commuter.route[commuter.currentEdgeIndex].from;
        if (commuter.route[commuter.currentEdgeIndex].mode === "metro") {
          commuter.state = "transferring";
          commuter.transferStart = now;
        } else {
          commuter.state = "walking";
          commuter.progress = 0;
        }
      }
    }
  });
  train.onboard = train.onboard.filter(commuter => commuter.state === "riding");
  train.originalSegment = null;
  if (!line.isLoop) {
    if (train.direction === 1 && train.currentSegment === line.stations.length - 2) {
      train.direction = -1;
    } else if (train.direction === -1 && train.currentSegment === 0) {
      train.direction = 1;
    } else {
      train.currentSegment += train.direction;
    }
  } else {
    train.currentSegment = (train.currentSegment + train.direction) % (line.stations.length - 1);
    if (train.currentSegment < 0) train.currentSegment += (line.stations.length - 1);
  }
  train.state = "dwell";
  train.dwellStart = now;
}

export function updateTrains(metroLines, now) {
  metroLines.forEach(line => {
    if (line.stations.length < 2) return;
    line.trains.forEach(train => {
      if (train.currentSegment < 0) train.currentSegment = 0;
      if (train.currentSegment > line.stations.length - 2) train.currentSegment = line.stations.length - 2;
      let from, to;
      if (train.direction === 1) {
        from = line.stations[train.currentSegment];
        to = line.stations[train.currentSegment+1];
      } else {
        from = line.stations[train.currentSegment+1];
        to = line.stations[train.currentSegment];
      }
      if (!from || !to) return;
      let segLength = distance(from.x, from.y, to.x, to.y);
      if (train.state === "dwell") {
        if (now - train.dwellStart >= dwellTime) {
          train.travelTime = computeTravelTime(segLength, acceleration, maxSpeed);
          train.state = "moving";
          train.departureTime = now;
          train.originalSegment = { from: { ...from }, to: { ...to }, travelTime: train.travelTime };
        }
      } else if (train.state === "moving") {
        let dx = to.x - from.x, dy = to.y - from.y;
        let normalized_dx = dx / segLength, normalized_dy = dy / segLength;
        let d = distance(train.position.x, train.position.y, to.x, to.y);
        if (d < maxSpeed) {
          train.position = { x: to.x, y: to.y };
          offloadPassengers(train, now);
        } else {
          train.position = { 
            x: train.position.x + normalized_dx * maxSpeed,
            y: train.position.y + normalized_dy * maxSpeed,
          };
        }
        train.onboard.forEach(commuter => {
          commuter.position = { x: train.position.x, y: train.position.y };
        });
      }
    });
  });
}
