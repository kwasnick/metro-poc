// drawing.js
import { computeTabPosition, distance } from "./utils.js";
import {
  stationRadius,
  tabRadius,
  tabMargin,
  holdThreshold,
} from "./constants.js";

export function drawStations(ctx, stations) {
  stations.forEach((s) => {
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
  let a = line.stations[segmentIndex],
    b = line.stations[segmentIndex + 1];
  let sameSegmentLines = metroLines.filter((l) => {
    for (let i = 0; i < l.stations.length - 1; i++) {
      let p = l.stations[i],
        q = l.stations[i + 1];
      if ((p.id === a.id && q.id === b.id) || (p.id === b.id && q.id === a.id))
        return true;
    }
    return false;
  });
  sameSegmentLines.sort((l1, l2) => l1.id - l2.id);
  let idx = sameSegmentLines.findIndex((l) => l.id === line.id);
  let count = sameSegmentLines.length;
  let offsetDistance = 10;
  let offset =
    count % 2 === 1
      ? (idx - Math.floor(count / 2)) * offsetDistance
      : (idx - count / 2 + 0.5) * offsetDistance;
  return offset;
}

export function drawMetroLines(ctx, metroLines) {
  metroLines.forEach((line) => {
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = line.color;
    for (let i = 0; i < line.stations.length - 1; i++) {
      let s1 = line.stations[i],
        s2 = line.stations[i + 1];
      let offset = getSegmentOffset(line, i, metroLines);
      let dx = s2.x - s1.x,
        dy = s2.y - s1.y;
      let len = Math.sqrt(dx * dx + dy * dy);
      let offX = (-dy / len) * offset;
      let offY = (dx / len) * offset;
      let startX = s1.x + offX;
      let startY = s1.y + offY;
      let endX = s2.x + offX;
      let endY = s2.y + offY;
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
    }

    // If the line is a loop, connect the last station back to the first.
    if (line.isLoop) {
      let s1 = line.stations[line.stations.length - 1],
        s2 = line.stations[0];
      // Use the last index for the offset calculation.
      let offset = getSegmentOffset(line, 0, metroLines);
      let dx = s2.x - s1.x,
        dy = s2.y - s1.y;
      let len = Math.sqrt(dx * dx + dy * dy);
      let offX = (-dy / len) * offset;
      let offY = (dx / len) * offset;
      let startX = s1.x + offX;
      let startY = s1.y + offY;
      let endX = s2.x + offX;
      let endY = s2.y + offY;
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();

    // Only add tabs if the line is not a loop and has at least two stations.
    if (!line.isLoop && line.stations.length >= 2) {
      // Length of the tab line sticking out
      const tabLineLength = 10; // adjust as needed

      ctx.save();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 4;

      // --- Draw the start tab ---
      // Use the first segment's direction (from first to second station)
      let firstStation = line.stations[0];
      let secondStation = line.stations[1];
      let dx = secondStation.x - firstStation.x;
      let dy = secondStation.y - firstStation.y;
      let len = Math.sqrt(dx * dx + dy * dy);
      let normX = dx / len;
      let normY = dy / len;
      // Compute the base point on the station's circumference,
      // sticking out in the opposite direction of the first segment.
      let startBase = {
        x: firstStation.x - normX * stationRadius,
        y: firstStation.y - normY * stationRadius,
      };
      let startTabEnd = {
        x: startBase.x - normX * tabLineLength,
        y: startBase.y - normY * tabLineLength,
      };

      ctx.beginPath();
      ctx.moveTo(startBase.x, startBase.y);
      ctx.lineTo(startTabEnd.x, startTabEnd.y);
      ctx.stroke();

      // --- Draw the end tab ---
      // Use the last segment's direction (from second-last to last station)
      let lastIndex = line.stations.length - 1;
      let lastStation = line.stations[lastIndex];
      let secondLastStation = line.stations[lastIndex - 1];
      dx = lastStation.x - secondLastStation.x;
      dy = lastStation.y - secondLastStation.y;
      len = Math.sqrt(dx * dx + dy * dy);
      normX = dx / len;
      normY = dy / len;
      // Compute the base point on the station's circumference,
      // sticking out in the same direction as the last segment.
      let endBase = {
        x: lastStation.x + normX * stationRadius,
        y: lastStation.y + normY * stationRadius,
      };
      let endTabEnd = {
        x: endBase.x + normX * tabLineLength,
        y: endBase.y + normY * tabLineLength,
      };

      ctx.beginPath();
      ctx.moveTo(endBase.x, endBase.y);
      ctx.lineTo(endTabEnd.x, endTabEnd.y);
      ctx.stroke();

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
      // Render original stations (faded)
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.strokeStyle = activeLine.color;
      activeLine.originalStations.forEach((s, i) => {
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      // If it's a loop, draw back to the first station.
      if (activeLine.isLoop) {
        ctx.lineTo(
          activeLine.originalStations[0].x,
          activeLine.originalStations[0].y
        );
      }
      ctx.stroke();
      ctx.restore();

      // Prepare modified stations by inserting the modify cursor
      let tempStations = activeLine.originalStations.slice();
      let idx = activeLine.modifySegmentIndex;
      tempStations.splice(idx + 1, 0, activeLine.modifyCursor);

      // If modifying the loop edge, ensure we complete the loop by adding the first station.
      if (activeLine.isLoop && idx === activeLine.originalStations.length - 1) {
        tempStations.push(activeLine.originalStations[0]);
      }

      // Render the modified line with thicker stroke and dashed style.
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = activeLine.color;
      ctx.setLineDash([5, 5]); // Set the dashed style
      tempStations.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]); // Reset to solid line style for future drawing
      ctx.lineWidth = 2;
    } else if (activeLine.editingMode === "extend") {
      let endpoint =
        activeLine.extendEnd === "end"
          ? activeLine.stations[activeLine.stations.length - 1]
          : activeLine.stations[0];
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
  metroLines.forEach((line) => {
    line.trains.forEach((train) => {
      // Calculate rotation based on the train's original segment if available
      let rotation = 0;
      if (train.originalSegment) {
        const dy = train.originalSegment.to.y - train.originalSegment.from.y;
        const dx = train.originalSegment.to.x - train.originalSegment.from.x;
        rotation = Math.atan2(dy, dx);
      }

      // Save the current canvas state
      ctx.save();

      // Translate the context to the train's position
      ctx.translate(train.position.x, train.position.y);
      // Rotate the context by the computed angle
      ctx.rotate(rotation);

      // Draw the train as a rectangle centered on (0,0)
      // For example, a 30x20 rectangle
      ctx.beginPath();
      ctx.rect(-15, -10, 30, 20); // offsets to center the rectangle
      ctx.fillStyle = line.color;
      ctx.fill();
      // Optionally add a border around the train
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
      ctx.stroke();

      // Restore the canvas state so further drawing is not affected
      ctx.restore();
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
      segments.push(
        `${prefix} walk from ${start.col},${start.row} to ${end.col},${end.row}`
      );
    } else if (mode === "metro") {
      let lineColor = currentEdge.line ? currentEdge.line.color : "";
      segments.push(
        `${prefix} train on ${lineColor} line from ${start.id} to ${end.id}`
      );
    }
  }
  return segments;
}

export function drawCommuters(ctx, commuters, pinnedCommuter) {
  commuters.forEach((commuter) => {
    let isHighlighted = pinnedCommuter && commuter === pinnedCommuter;

    // Draw commuter as a blue circle.
    ctx.beginPath();
    ctx.arc(commuter.position.x, commuter.position.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "blue";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();

    if (isHighlighted) {
      // Draw the commuter's route as a dotted, translucent red line.
      if (commuter.route && commuter.route.length > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5; // Set transparency
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dotted line pattern
        ctx.beginPath();
        // Start at the commuter's current position.
        ctx.moveTo(commuter.position.x, commuter.position.y);
        let startIndex = commuter.currentEdgeIndex || 0;
        for (let i = startIndex; i < commuter.route.length; i++) {
          let edge = commuter.route[i];
          ctx.lineTo(edge.to.x, edge.to.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw highlighting text.
      ctx.fillStyle = "black";
      ctx.font = "bold 10px Arial";
      ctx.fillText(
        "State: " + commuter.state,
        commuter.position.x,
        commuter.position.y + 15
      );

      ctx.fillStyle = "red";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "→ " +
          commuter.position.x.toFixed(3) +
          "," +
          commuter.position.y.toFixed(3),
        commuter.position.x + 8,
        commuter.position.y
      );

      ctx.fillStyle = "black";
      ctx.font = "bold 10px Arial";
      let routePlan = printRoute(commuter);
      for (let i = 0; i < routePlan.length; i++) {
        ctx.fillText(
          routePlan[i],
          commuter.position.x + 8,
          commuter.position.y - 15 * routePlan.length + 15 * i
        );
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

/**
 * Draw animations for station creation and removal.
 * - For station creation, a growing circle is drawn over the grid node.
 * - For station removal, the station is drawn with a shaking effect.
 */
export function drawStationAnimations(ctx, state, now) {
  // Animate station removal hold (shaking effect)
  if (state.stationRemovalAnimation) {
    // calculate progress using the duration
    const progress =
      (Date.now() - state.stationRemovalAnimation.startTime) / holdThreshold;
    const station = state.stationRemovalAnimation.station;
    // Shake amplitude increases with progress.
    const shakeAmplitude = 5 * progress;
    const offsetX = Math.sin(now / 20) * shakeAmplitude;
    const offsetY = Math.cos(now / 20) * shakeAmplitude;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.beginPath();
    ctx.arc(station.x, station.y, stationRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; // red tint for removal
    ctx.fill();
    ctx.strokeStyle = "red";
    ctx.stroke();
    ctx.restore();
  }
}

export function draw(
  ctx,
  bgCanvas,
  metroLines,
  activeLine,
  currentMousePos,
  stations,
  commuters,
  pinnedCommuter,
  arrivalEffects,
  now,
  state
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawBackground(ctx, bgCanvas);
  drawMetroLines(ctx, metroLines);
  drawActiveLine(ctx, activeLine, currentMousePos);
  drawStations(ctx, stations);
  drawTrains(ctx, metroLines);
  drawCommuters(ctx, commuters, pinnedCommuter);
  drawArrivalEffects(ctx, arrivalEffects, now);
  drawStationAnimations(ctx, state, now);
}
