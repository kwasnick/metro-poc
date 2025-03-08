import { distance } from "./utils.js";
import { acceleration, maxSpeed, dwellTime } from "./constants.js";
import { computeTravelTime } from "./utils.js";

export function spawnDefaultTrains(line) {
  line.trains = [];
  let now = performance.now();
  if (!line.isLoop) {
    // Spawn the positive-direction train at the first station.
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
      position: { x: line.stations[0].x, y: line.stations[0].y },
    });
    // Spawn the negative-direction train at the last station.
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
      position: {
        x: line.stations[line.stations.length - 1].x,
        y: line.stations[line.stations.length - 1].y,
      },
    });
  } else {
    // For loop lines both trains start at station 0.
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
      position: { x: line.stations[0].x, y: line.stations[0].y },
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
      position: { x: line.stations[0].x, y: line.stations[0].y },
    });
  }
}

function offloadPassengers(train, now) {
  let line = train.line;
  let arrivalStation = train.originalSegment ? train.originalSegment.to : null;
  if (!arrivalStation) return;

  train.onboard.forEach((commuter) => {
    if (
      commuter.route &&
      commuter.route[commuter.currentEdgeIndex] &&
      commuter.route[commuter.currentEdgeIndex].mode === "metro" &&
      commuter.route[commuter.currentEdgeIndex].to.id === arrivalStation.id
    ) {
      commuter.currentEdgeIndex += 1;
    }
    if (
      commuter.state === "riding" &&
      commuter.targetStop &&
      commuter.targetStop.id === arrivalStation.id
    ) {
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
  train.onboard = train.onboard.filter(
    (commuter) => commuter.state === "riding"
  );
  // Clear the original segment now that we've reached its destination.
  train.originalSegment = null;

  // Check if the arrival station still exists on the train's line.
  let stationIndex = line.stations.findIndex(
    (station) => station.id === arrivalStation.id
  );

  if (stationIndex === -1) {
    // The arrival station has been removed from the line.
    train.onboard.forEach((commuter) => {
      commuter.currentEdgeIndex = 0;
      commuter.route = null; // Signal that a new route is needed.
      commuter.state = "waiting";
    });
    train.onboard = [];
    if (line.stations.length > 0) {
      train.position = { x: line.stations[0].x, y: line.stations[0].y };
      train.currentSegment = 0;
    }
    if (!line.isLoop) {
      train.direction = 1;
    }
    train.state = "dwell";
    train.dwellStart = now;
    return;
  }

  // Arrival station still exists: update currentSegment based on its new index.
  if (!line.isLoop) {
    if (stationIndex === 0 && train.direction === -1) {
      train.direction = 1;
    } else if (
      stationIndex === line.stations.length - 1 &&
      train.direction === 1
    ) {
      train.direction = -1;
    }
    train.currentSegment = stationIndex;
  } else {
    train.currentSegment = stationIndex;
  }
  train.state = "dwell";
  train.dwellStart = now;
}

export function updateTrains(metroLines, now) {
  metroLines.forEach((line) => {
    if (line.stations.length < 2) return;
    line.trains.forEach((train) => {
      if (train.currentSegment < 0) train.currentSegment = 0;
      if (train.currentSegment > line.stations.length - 2)
        train.currentSegment = line.stations.length - 2;

      // Use the locked-in original segment if in motion.
      let segFrom, segTo;
      if (train.state === "moving" && train.originalSegment) {
        segFrom = train.originalSegment.from;
        segTo = train.originalSegment.to;
      } else {
        if (train.direction === 1) {
          segFrom = line.stations[train.currentSegment];
          segTo = line.stations[train.currentSegment + 1];
        } else {
          segFrom = line.stations[train.currentSegment + 1];
          segTo = line.stations[train.currentSegment];
        }
      }
      if (!segFrom || !segTo) return;
      let segLength = distance(segFrom.x, segFrom.y, segTo.x, segTo.y);

      if (train.state === "dwell") {
        if (now - train.dwellStart >= dwellTime) {
          train.travelTime = computeTravelTime(
            segLength,
            acceleration,
            maxSpeed
          );
          train.state = "moving";
          train.departureTime = now;
          // Lock in the original segment.
          train.originalSegment = {
            from: { ...segFrom },
            to: { ...segTo },
            travelTime: train.travelTime,
          };
        }
      } else if (train.state === "moving") {
        let dx = segTo.x - segFrom.x,
          dy = segTo.y - segFrom.y;
        let normalized_dx = dx / segLength,
          normalized_dy = dy / segLength;
        let d = distance(train.position.x, train.position.y, segTo.x, segTo.y);
        if (d < maxSpeed) {
          train.position = { x: segTo.x, y: segTo.y };
          offloadPassengers(train, now);
        } else {
          train.position = {
            x: train.position.x + normalized_dx * maxSpeed,
            y: train.position.y + normalized_dy * maxSpeed,
          };
        }
        train.onboard.forEach((commuter) => {
          commuter.position = { x: train.position.x, y: train.position.y };
        });
      }
    });
  });
}
