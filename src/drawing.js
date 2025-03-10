// drawing.js
import { computeTabPosition, distance } from "./utils.js";
import {
  stationRadius,
  tabMargin,
  holdThreshold,
  COLOR_NAMES,
} from "./constants.js";

export function drawStations(ctx, stations, commuters) {
  stations.forEach((s) => {
    // Draw the station circle.
    ctx.beginPath();
    ctx.arc(s.x, s.y, stationRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "#FFF";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.stroke();

    // Draw the station id in the center.
    ctx.fillStyle = "#000";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.id, s.x, s.y);

    // Count the number of commuters at this station.
    // Adjust this logic if commuter positions are stored differently.
    const passengerCount = commuters.filter(
      (c) =>
        c.position.x === s.x &&
        c.position.y === s.y &&
        (c.state === "waitingForTrain" || c.state === "transferring")
    ).length;

    // Draw the passenger count near the station.
    // Here we position the count at the top right relative to the station.
    ctx.font = "10px Arial";
    ctx.fillStyle = "#555";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(passengerCount, s.x + stationRadius, s.y - stationRadius);
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
      ctx.save();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 10;

      // --- Draw the start tab ---
      const startTab = computeTabPosition(
        line,
        "start",
        stationRadius,
        tabMargin
      );
      const firstStation = line.stations[0];
      // Get the normalized direction from first station to second station, but reversed
      let dx = firstStation.x - line.stations[1].x;
      let dy = firstStation.y - line.stations[1].y;
      let len = Math.sqrt(dx * dx + dy * dy);
      let dirX = dx / len;
      let dirY = dy / len;
      // Compute the base point on the station's circumference (center plus direction scaled by stationRadius)
      const startBase = {
        x: firstStation.x + dirX * stationRadius,
        y: firstStation.y + dirY * stationRadius,
      };

      ctx.beginPath();
      ctx.moveTo(startBase.x, startBase.y);
      ctx.lineTo(startTab.x, startTab.y);
      ctx.stroke();

      // --- Draw the end tab ---
      const endTab = computeTabPosition(line, "end", stationRadius, tabMargin);
      const lastStation = line.stations[line.stations.length - 1];
      // Get the normalized direction from second-last to last station
      dx = lastStation.x - line.stations[line.stations.length - 2].x;
      dy = lastStation.y - line.stations[line.stations.length - 2].y;
      len = Math.sqrt(dx * dx + dy * dy);
      dirX = dx / len;
      dirY = dy / len;
      // Compute the base point on the station's circumference (center plus direction scaled by stationRadius)
      const endBase = {
        x: lastStation.x + dirX * stationRadius,
        y: lastStation.y + dirY * stationRadius,
      };

      ctx.beginPath();
      ctx.moveTo(endBase.x, endBase.y);
      ctx.lineTo(endTab.x, endTab.y);
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
      let rotation = train.rotation;
      if (train.originalSegment) {
        const dy = train.originalSegment.to.y - train.originalSegment.from.y;
        const dx = train.originalSegment.to.x - train.originalSegment.from.x;
        rotation = Math.atan2(dy, dx);
        train.rotation = rotation;
      }

      // Save the current canvas state
      ctx.save();

      // Translate the context to the train's position
      ctx.translate(train.position.x, train.position.y);
      // Rotate the context by the computed angle
      ctx.rotate(rotation);

      // Draw the train as a rectangle centered on (0,0)
      // For example, a 24x12 rectangle
      ctx.beginPath();
      ctx.rect(-12, -6, 24, 12); // offsets to center the rectangle
      ctx.fillStyle = line.color;
      ctx.fill();
      // Add a border around the train
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
      ctx.stroke();

      // Draw riders on the train as tiny blue circles.
      // Each rider is a 4x4 cell (circle with radius 2), arranged from top left to bottom right,
      // with up to 3 riders per row.
      const riderSize = 4; // each cell is 4x4
      const maxColumns = 3;
      // Define the starting point for the riders area.
      // Here we assume the rider area is 12 units wide (3 cells x 4 units),
      // and we center this area within the train's rectangle.
      const startX = -12; // (12/2) left offset to center a 12-wide area in a 24-wide rectangle
      const startY = -6; // start at the top of the rectangle

      for (let i = 0; i < train.onboard.length; i++) {
        const col = i % maxColumns;
        const row = Math.floor(i / maxColumns);
        const cx = startX + col * riderSize + riderSize / 2; // center of the cell horizontally
        const cy = startY + row * riderSize + riderSize / 2; // center of the cell vertically
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
        ctx.fillStyle = "blue";
        ctx.fill();
      }

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
      let lineColorName = COLOR_NAMES[lineColor];
      segments.push(
        `${prefix} train on ${lineColorName} line from ${start.id} to ${end.id}`
      );
    }
  }
  return segments;
}

export function drawCommuters(ctx, commuters, pinnedCommuter) {
  commuters.forEach((commuter) => {
    let isHighlighted = pinnedCommuter && commuter === pinnedCommuter;

    // Draw commuter as a blue circle.
    // However, if the commuter is riding, waiting, or transferring, then it isn't drawn
    // (it'll be handled by the station or train)
    if (commuter.state === "walking") {
      ctx.beginPath();
      ctx.arc(commuter.position.x, commuter.position.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "blue";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }

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

export function drawBoardEffects(ctx, boardEffects, now) {
  for (let i = boardEffects.length - 1; i >= 0; i--) {
    let effect = boardEffects[i];
    let dt = now - effect.startTime;
    let duration = 300;
    if (dt > duration) {
      boardEffects.splice(i, 1);
    } else {
      let progress = dt / duration;
      let alpha = 1 - progress;
      let radius = 10 + 10 * progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = "black";
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
  boardEffects,
  now,
  state
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawBackground(ctx, bgCanvas);
  drawMetroLines(ctx, metroLines);
  drawActiveLine(ctx, activeLine, currentMousePos);
  drawStations(ctx, stations, commuters);
  drawTrains(ctx, metroLines);
  drawCommuters(ctx, commuters, pinnedCommuter);
  drawArrivalEffects(ctx, arrivalEffects, now);
  drawBoardEffects(ctx, boardEffects, now);
  drawStationAnimations(ctx, state, now);
}
