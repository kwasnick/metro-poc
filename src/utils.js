// utils.js
import { stationRadius, snapThreshold } from "./constants.js";

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function getStationAt(x, y, stations) {
  for (let s of stations) {
    if (distance(x, y, s.x, s.y) < stationRadius) return s;
  }
  return null;
}

export function getSnappedStation(x, y, stations) {
  for (let s of stations) {
    if (distance(x, y, s.x, s.y) < snapThreshold) return s;
  }
  return null;
}

export function distanceToSegment(px, py, x1, y1, x2, y2) {
  const l2 = Math.pow(distance(x1, y1, x2, y2), 2);
  if (l2 === 0) return distance(px, py, x1, y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1));
}

export function computeTravelTime(d, acceleration, maxSpeed) {
  const t_acc = maxSpeed / acceleration;
  const d_acc = 0.5 * acceleration * t_acc * t_acc;
  if (d >= 2 * d_acc) {
    let t_cruise = (d - 2 * d_acc) / maxSpeed;
    return t_acc + t_cruise + t_acc;
  } else {
    return 2 * Math.sqrt(d / acceleration);
  }
}

export function darkenColor(hex, factor) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.floor(r * factor);
  g = Math.floor(g * factor);
  b = Math.floor(b * factor);
  return (
    "#" +
    ("0" + r.toString(16)).slice(-2) +
    ("0" + g.toString(16)).slice(-2) +
    ("0" + b.toString(16)).slice(-2)
  );
}

export function computeTabPosition(
  line,
  endpointType,
  stationRadius,
  tabMargin
) {
  let tab = { x: 0, y: 0 };
  if (line.stations.length < 2) return tab;
  if (endpointType === "end") {
    let last = line.stations[line.stations.length - 1];
    let prev = line.stations[line.stations.length - 2];
    let dx = last.x - prev.x,
      dy = last.y - prev.y;
    let len = Math.sqrt(dx * dx + dy * dy);
    let dirX = dx / len,
      dirY = dy / len;
    tab.x = last.x + dirX * (stationRadius + tabMargin);
    tab.y = last.y + dirY * (stationRadius + tabMargin);
  } else if (endpointType === "start") {
    let first = line.stations[0];
    let next = line.stations[1];
    let dx = first.x - next.x,
      dy = first.y - next.y;
    let len = Math.sqrt(dx * dx + dy * dy);
    let dirX = dx / len,
      dirY = dy / len;
    tab.x = first.x + dirX * (stationRadius + tabMargin);
    tab.y = first.y + dirY * (stationRadius + tabMargin);
  }
  return tab;
}

export function generateRandomStationId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let id = "";
  for (let i = 0; i < 2; i++) {
    id += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return id;
}

export function roundTo(num, to) {
  return parseFloat(num.toFixed(to));
}
