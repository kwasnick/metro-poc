// drawing.js
import { computeTabPosition, distance } from "./utils.js";
import { stationRadius, tabRadius, tabMargin } from "./constants.js";

export function drawStations(ctx, stations) {
  stations.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, stationRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "#FFF";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.id, s.x, s.y);
  });
}

export function getSegmentOffset(line, segmentIndex, metroLines) {
  let a = line.stations[segmentIndex], b = line.stations[segmentIndex+1];
  let sameSegmentLines = metroLines.filter(l => {
    for (let i = 0; i < l.stations.length - 1; i++) {
      let p = l.stations[i], q = l.stations[i+1];
      if ((p.id === a.id && q.id === b.id) || (p.id === b.id && q.id === a.id)) return true;
    }
    return false;
  });
  sameSegmentLines.sort((l1, l2) => l1.id - l2.id);
  let idx = sameSegmentLines.findIndex(l => l.id === line.id);
  let count = sameSegmentLines.length;
  let offsetDistance = 10;
  let offset = (count % 2 === 1)
    ? (idx - Math.floor(count / 2)) * offsetDistance
    : (idx - count / 2 + 0.5) * offsetDistance;
  return offset;
}

export function drawMetroLines(ctx, metroLines) {
  metroLines.forEach(line => {
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = line.color;
    for (let i = 0; i < line.stations.length - 1; i++) {
      let s1 = line.stations[i], s2 = line.stations[i+1];
      let offset = getSegmentOffset(line, i, metroLines);
      let dx = s2.x - s1.x, dy = s2.y - s1.y;
      let len = Math.sqrt(dx * dx + dy * dy);
      let offX = -dy / len * offset;
      let offY = dx / len * offset;
      ctx.moveTo(s1.x + offX, s1.y + offY);
      ctx.lineTo(s2.x + offX, s2.y + offY);
    }
    ctx.stroke();
    ctx.lineWidth = 2;
    if (!line.isLoop && line.stations.length >= 2) {
      let startTab = computeTabPosition(line, "start", stationRadius, tabMargin);
      let endTab = computeTabPosition(line, "end", stationRadius, tabMargin);
      ctx.save();
      ctx.fillStyle = line.color;
      ctx.beginPath();
      ctx.arc(startTab.x, startTab.y, tabRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(endTab.x, endTab.y, tabRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
  });
}

export function drawActiveLine(ctx, activeLine, currentMousePos) {
  if (activeLine) {
    if (activeLine.editingMode === "new") {
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = activeLine.color;
      activeLine.stations.forEach((s, i) => {
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.lineTo(currentMousePos.x, currentMousePos.y);
      ctx.stroke();
      ctx.lineWidth = 2;
    } else if (activeLine.editingMode === "modify") {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.strokeStyle = activeLine.color;
      activeLine.originalStations.forEach((s, i) => {
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
      ctx.restore();
      let tempStations = activeLine.originalStations.slice();
      let idx = activeLine.modifySegmentIndex;
      tempStations.splice(idx + 1, 0, activeLine.modifyCursor);
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = activeLine.color;
      tempStations.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.lineWidth = 2;
    } else if (activeLine.editingMode === "extend") {
      let endpoint = activeLine.extendEnd === "end" ? activeLine.stations[activeLine.stations.length - 1] : activeLine.stations[0];
      ctx.save();
      ctx.strokeStyle = activeLine.color;
      ctx.lineWidth = 4;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(endpoint.x, endpoint.y);
      ctx.lineTo(activeLine.extendCursor.x, activeLine.extendCursor.y);
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 2;
    }
  }
}

export function drawTrains(ctx, metroLines) {
  metroLines.forEach(line => {
    line.trains.forEach(train => {
      ctx.beginPath();
      ctx.arc(train.position.x, train.position.y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = line.color;
      ctx.fill();
    });
  });
}

function printRoute(commuter) {
  let route = commuter.route;
  if (!route || route.length === 0) return "";
  let segments = [];
  for (let i = 0; i < route.length; i++) {
    let prefix = i === commuter.currentEdgeIndex ? ">" : " ";
    let currentEdge = route[i];
    let mode = currentEdge.mode;
    let start = currentEdge.from;
    let end = currentEdge.to;
    if (mode === "walk") {
      segments.push(`${prefix} walk from ${start.col},${start.row} to ${end.col},${end.row}`);
    } else if (mode === "metro") {
      let lineColor = currentEdge.line ? currentEdge.line.color : "";
      segments.push(`${prefix} train on ${lineColor} line from ${start.id} to ${end.id}`);
    }
  }
  return segments;
}

export function drawCommuters(ctx, commuters, pinnedCommuter) {
  commuters.forEach(commuter => {
    let isHighlighted = (pinnedCommuter && commuter === pinnedCommuter);
    ctx.beginPath();
    ctx.arc(commuter.position.x, commuter.position.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "blue";
    ctx.fill();
    if (isHighlighted) {
      ctx.fillStyle = "black";
      ctx.font = "bold 10px Arial";
      ctx.fillText("State: " + commuter.state, commuter.position.x, commuter.position.y + 15);
      ctx.fillStyle = "red";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("→ " + commuter.position.x.toFixed(3) + "," + commuter.position.y.toFixed(3), commuter.position.x + 8, commuter.position.y);
      ctx.fillStyle = "black";
      ctx.font = "bold 10px Arial";
      let routePlan = printRoute(commuter);
      for (let i = 0; i < routePlan.length; i++) {
        ctx.fillText(routePlan[i], commuter.position.x + 8, commuter.position.y - (15 * routePlan.length) + 15 * i);
      }
    }
  });
}

export function drawArrivalEffects(ctx, arrivalEffects, now) {
  for (let i = arrivalEffects.length - 1; i >= 0; i--) {
    let effect = arrivalEffects[i];
    let dt = now - effect.startTime;
    let duration = 1000;
    if (dt > duration) {
      arrivalEffects.splice(i, 1);
    } else {
      let progress = dt / duration;
      let alpha = 1 - progress;
      let radius = 20 + 20 * progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = "gold";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }
}

export function drawBackground(ctx, bgCanvas) {
  ctx.drawImage(bgCanvas, 0, 0);
}

export function draw(ctx, bgCanvas, metroLines, activeLine, currentMousePos, stations, commuters, pinnedCommuter, arrivalEffects, now) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawBackground(ctx, bgCanvas);
  drawMetroLines(ctx, metroLines);
  drawActiveLine(ctx, activeLine, currentMousePos);
  drawStations(ctx, stations);
  drawTrains(ctx, metroLines);
  drawCommuters(ctx, commuters, pinnedCommuter);
  drawArrivalEffects(ctx, arrivalEffects, now);
}
