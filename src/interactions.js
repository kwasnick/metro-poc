// interactions.js
import { getStationAt, getSnappedStation, distance, distanceToSegment, computeTabPosition } from "./utils.js";
import { stationRadius, snapThreshold, tabRadius, tabMargin } from "./constants.js";
import { spawnDefaultTrains } from "./trains.js";

export function setupInteractions(canvas, uiElements, state, gridNodes, stations, metroLines, commuters, recalcCommuterRoutesFunc) {
  const { lineColorDropdown, newLineButton, deleteLineButton } = uiElements;

  function recalcCommuterRoutesCallback() {
    recalcCommuterRoutesFunc(
      commuters,
      gridNodes,
      metroLines,
    );
  }

  // Toggle new line mode:
  newLineButton.addEventListener('click', () => {
    if (state.activeLine && state.activeLine.editingMode === "new") {
      state.activeLine = null;
    } else {
      state.activeLine = {
        id: state.nextLineId++,
        color: lineColorDropdown.value,
        stations: [],
        trains: [],
        editingMode: "new"
      };
    }
  });
  
  deleteLineButton.addEventListener('click', () => {
    metroLines = metroLines.filter(line => line.color !== lineColorDropdown.value);
    recalcCommuterRoutesCallback();
  });
  
  let isDragging = false;
  let currentMousePos = { x: 0, y: 0 };
  
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (!state.activeLine) {
      let clickedTab = null;
      let extendEnd = null;
      for (let line of metroLines) {
        if (line.isLoop) continue;
        let tabStart = computeTabPosition(line, "start", stationRadius, tabMargin);
        let tabEnd = computeTabPosition(line, "end", stationRadius, tabMargin);
        if (distance(x, y, tabStart.x, tabStart.y) < 8) {
          clickedTab = line;
          extendEnd = "start";
          break;
        } else if (distance(x, y, tabEnd.x, tabEnd.y) < 8) {
          clickedTab = line;
          extendEnd = "end";
          break;
        }
      }
      if (clickedTab) {
        state.activeLine = clickedTab;
        state.activeLine.editingMode = "extend";
        state.activeLine.extendEnd = extendEnd;
        state.activeLine.extendCursor = { x, y };
        state.activeLine.extendCandidate = null;
        isDragging = true;
        return;
      }
    }
    if (!state.activeLine) {
      let segInfo = null;
      for (let line of metroLines) {
        for (let i = 0; i < line.stations.length - 1; i++) {
          let a = line.stations[i], b = line.stations[i+1];
          let d = distanceToSegment(x, y, a.x, a.y, b.x, b.y);
          if (d < 5) { segInfo = { line, segmentIndex: i }; break; }
        }
        if (segInfo) break;
      }
      if (segInfo) {
        state.activeLine = segInfo.line;
        state.activeLine.editingMode = "modify";
        state.activeLine.modifySegmentIndex = segInfo.segmentIndex;
        state.activeLine.originalStations = state.activeLine.stations.slice();
        state.activeLine.modifyCursor = { x, y };
        state.activeLine.modifyCandidate = null;
      }
    } else if (state.activeLine.editingMode === "new") {
      if (state.activeLine.stations.length === 0) {
        let s = getStationAt(x, y, stations);
        if (s) state.activeLine.stations.push(s);
      }
    }
    isDragging = true;
  });
  
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = e.clientX - rect.left;
    currentMousePos.y = e.clientY - rect.top;
    state.currentMousePos = currentMousePos;

    if (state.activeLine && isDragging) {
      if (state.activeLine.editingMode === "new") {
        let snapped = getSnappedStation(currentMousePos.x, currentMousePos.y, stations);
        if (snapped) {
          let arr = state.activeLine.stations;
          if (snapped.id === arr[0].id && arr.length >= 2) {
            if (arr[arr.length-1].id !== snapped.id) arr.push(snapped);
          } else {
            if (arr.length > 1 && arr[arr.length-2].id === snapped.id) {
              arr.pop();
            } else if (!arr.some(s => s.id === snapped.id)) {
              arr.push(snapped);
            }
          }
        }
      } else if (state.activeLine.editingMode === "modify") {
        let candidate = getSnappedStation(currentMousePos.x, currentMousePos.y, stations);
        if (candidate) {
          state.activeLine.modifyCursor = { x: candidate.x, y: candidate.y };
          state.activeLine.modifyCandidate = candidate;
        } else {
          state.activeLine.modifyCursor = { x: currentMousePos.x, y: currentMousePos.y };
          state.activeLine.modifyCandidate = null;
        }
      } else if (state.activeLine.editingMode === "extend") {
        let candidate = getSnappedStation(currentMousePos.x, currentMousePos.y, stations);
        if (candidate) {
          state.activeLine.extendCursor = { x: candidate.x, y: candidate.y };
          state.activeLine.extendCandidate = candidate;
        } else {
          state.activeLine.extendCursor = { x: currentMousePos.x, y: currentMousePos.y };
          state.activeLine.extendCandidate = null;
        }
      }
    }
  });
  
  canvas.addEventListener('mouseup', (e) => {
    isDragging = false;
    if (state.activeLine) {
      if (state.activeLine.editingMode === "modify") {
        let idx = state.activeLine.modifySegmentIndex;
        let X = state.activeLine.originalStations[idx];
        let Y = state.activeLine.originalStations[idx+1];
        let minStations = state.activeLine.isLoop ? 3 : 2;
        if (state.activeLine.modifyCandidate) {
          if ((state.activeLine.modifyCandidate.id === X.id || state.activeLine.modifyCandidate.id === Y.id) && state.activeLine.originalStations.length > minStations) {
            state.activeLine.stations = state.activeLine.originalStations.slice();
            if (state.activeLine.modifyCandidate.id === X.id) {
              state.activeLine.stations.splice(idx, 1);
            } else {
              state.activeLine.stations.splice(idx+1, 1);
            }
          } else if (state.activeLine.modifyCandidate.id !== X.id && state.activeLine.modifyCandidate.id !== Y.id) {
            if (!state.activeLine.originalStations.some(s => s.id === state.activeLine.modifyCandidate.id)) {
              state.activeLine.stations = state.activeLine.originalStations.slice();
              state.activeLine.stations.splice(idx+1, 0, state.activeLine.modifyCandidate);
            } else {
              state.activeLine.stations = state.activeLine.originalStations.slice();
            }
          } else {
            state.activeLine.stations = state.activeLine.originalStations.slice();
          }
        }
        state.activeLine.editingMode = "new";
        state.activeLine = null;
        recalcCommuterRoutesCallback();
      } else if (state.activeLine.editingMode === "extend") {
        if (state.activeLine.extendCandidate) {
          if (state.activeLine.extendEnd === "end") {
            if (state.activeLine.extendCandidate.id === state.activeLine.stations[0].id && state.activeLine.stations.length >= 2) {
              state.activeLine.stations.push(state.activeLine.extendCandidate);
              state.activeLine.isLoop = true;
            } else if (!state.activeLine.stations.some(s => s.id === state.activeLine.extendCandidate.id)) {
              state.activeLine.stations.push(state.activeLine.extendCandidate);
            }
          } else if (state.activeLine.extendEnd === "start") {
            if (state.activeLine.extendCandidate.id === state.activeLine.stations[state.activeLine.stations.length-1].id && state.activeLine.stations.length >= 2) {
              state.activeLine.stations.unshift(state.activeLine.extendCandidate);
              state.activeLine.isLoop = true;
            } else if (!state.activeLine.stations.some(s => s.id === state.activeLine.extendCandidate.id)) {
              state.activeLine.stations.unshift(state.activeLine.extendCandidate);
            }
          }
        }
        state.activeLine = null;
        recalcCommuterRoutesCallback();
      }
    }
  });
  
  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (state.activeLine && state.activeLine.editingMode === "new") {
      if (state.activeLine.stations.length >= 2) {
        if (state.activeLine.stations[0].id === state.activeLine.stations[state.activeLine.stations.length-1].id && state.activeLine.stations.length >= 3) {
          state.activeLine.isLoop = true;
        } else {
          state.activeLine.isLoop = false;
        }
        metroLines.push(state.activeLine);
        spawnDefaultTrains(state.activeLine);
        recalcCommuterRoutesCallback();
      }
      state.activeLine = null;
    } else {
      let closest = null, bestDist = Infinity;
      for (let key in gridNodes) {
        let node = gridNodes[key];
        let d = distance(x, y, node.x, node.y);
        if (d < bestDist) { bestDist = d; closest = node; }
      }
      if (bestDist < snapThreshold) {
        let exists = stations.find(s => s.col === closest.col && s.row === closest.row);
        if (!exists) {
          let newStation = { id: String.fromCharCode(65 + stations.length), x: closest.x, y: closest.y, col: closest.col, row: closest.row };
          stations.push(newStation);
          recalcCommuterRoutesCallback();
        }
      }
    }
  });
  
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    let stationToRemove = null;
    for (let s of stations) {
      if (distance(x, y, s.x, s.y) < snapThreshold) {
        stationToRemove = s;
        break;
      }
    }
    if (stationToRemove) {
      stations = stations.filter(s => s !== stationToRemove);
      metroLines.forEach(line => {
        line.stations = line.stations.filter(s => s.id !== stationToRemove.id);
      });
      recalcCommuterRoutesCallback();
    }
  });
  
  canvas.addEventListener('click', (e) => {
    if (state.activeLine) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    let found = null;
    for (let commuter of commuters) {
      if (distance(x, y, commuter.position.x, commuter.position.y) < 15) {
        found = commuter;
        break;
      }
    }
    if (found) {
      state.pinnedCommuter = found;
    } else {
      state.pinnedCommuter = null;
    }
  });
}
