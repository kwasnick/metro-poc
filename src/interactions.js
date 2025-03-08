// interactions.js
import {
  getStationAt,
  getSnappedStation,
  distance,
  distanceToSegment,
  computeTabPosition,
} from "./utils.js";
import {
  holdThreshold,
  stationRadius,
  snapThreshold,
  tabRadius,
  tabMargin,
} from "./constants.js";
import { spawnDefaultTrains } from "./trains.js";
import { stations, metroLines, commuters } from "./globals.js";

export function setupInteractions(
  canvas,
  uiElements,
  state,
  gridNodes,
  recalcCommuterRoutesFunc
) {
  const { lineColorDropdown, newLineButton, deleteLineButton } = uiElements;

  function recalcCommuterRoutesCallback() {
    recalcCommuterRoutesFunc(commuters, gridNodes, metroLines);
  }

  // ---- New Hold Parameters ----
  let stationCreationHoldTimer = null;
  let stationRemovalHoldTimer = null;

  // Animation states for station creation/removal.
  state.stationCreationAnimation = null; // { node, startTime, progress }
  state.stationRemovalAnimation = null; // { station, startTime, progress }

  // Toggle new line mode:
  newLineButton.addEventListener("click", () => {
    if (state.activeLine && state.activeLine.editingMode === "new") {
      state.activeLine = null;
    } else {
      state.activeLine = {
        id: state.nextLineId++,
        color: lineColorDropdown.value,
        stations: [],
        trains: [],
        editingMode: "new",
      };
    }
  });

  deleteLineButton.addEventListener("click", () => {
    metroLines = metroLines.filter(
      (line) => line.color !== lineColorDropdown.value
    );
    recalcCommuterRoutesCallback();
  });

  let isDragging = false;
  let currentMousePos = { x: 0, y: 0 };

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    currentMousePos = { x, y };
    state.currentMousePos = currentMousePos;

    // ---- If no metro line is active, check for station creation/removal via hold ----
    if (!state.activeLine) {
      // (A) Prioritize metro line tab interactions:
      let clickedTab = null;
      let extendEnd = null;
      for (let line of metroLines) {
        if (line.isLoop) continue;
        let tabStart = computeTabPosition(
          line,
          "start",
          stationRadius,
          tabMargin
        );
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

      // (B) Check if clicking on an existing station for removal.
      let clickedStation = getStationAt(x, y, stations);
      if (clickedStation) {
        // Start a removal hold timer and animation.
        stationRemovalHoldTimer = setTimeout(() => {
          // Remove the station after a long enough hold.
          stations.splice(
            stations.findIndex((s) => s === clickedStation),
            1
          );
          metroLines.forEach((line) => {
            line.stations = line.stations.filter(
              (s) => s.id !== clickedStation.id
            );
          });
          recalcCommuterRoutesCallback();
          state.stationRemovalAnimation = null;
        }, holdThreshold);
        state.stationRemovalAnimation = {
          station: clickedStation,
          startTime: Date.now(),
          progress: 0,
        };
        isDragging = true;
        return;
      }

      // (C) Otherwise, if near a grid node, start a station creation hold.
      let closest = null,
        bestDist = Infinity;
      for (let key in gridNodes) {
        let node = gridNodes[key];
        let d = distance(x, y, node.x, node.y);
        if (d < bestDist) {
          bestDist = d;
          closest = node;
        }
      }
      if (closest && bestDist < snapThreshold) {
        stationCreationHoldTimer = setTimeout(() => {
          // Create the station once the hold threshold is met.
          let exists = stations.find(
            (s) => s.col === closest.col && s.row === closest.row
          );
          if (!exists) {
            let newStation = {
              id: String.fromCharCode(65 + stations.length),
              x: closest.x,
              y: closest.y,
              col: closest.col,
              row: closest.row,
            };
            stations.push(newStation);
            recalcCommuterRoutesCallback();
          }
          state.stationCreationAnimation = null;
        }, holdThreshold);

        state.stationCreationAnimation = {
          node: closest,
          startTime: Date.now(),
          progress: 0,
        };
        isDragging = true;
        return;
      }
    }

    // ---- Existing metro line interactions ----
    if (!state.activeLine) {
      // Check for metro line segment modification.
      let segInfo = null;
      for (let line of metroLines) {
        for (let i = 0; i < line.stations.length - 1; i++) {
          let a = line.stations[i],
            b = line.stations[i + 1];
          let d = distanceToSegment(x, y, a.x, a.y, b.x, b.y);
          if (d < 5) {
            segInfo = { line, segmentIndex: i };
            break;
          }
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
      // If starting a new line, add the first station if available.
      if (state.activeLine.stations.length === 0) {
        let s = getStationAt(x, y, stations);
        if (s) state.activeLine.stations.push(s);
      }
    }
    isDragging = true;
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = e.clientX - rect.left;
    currentMousePos.y = e.clientY - rect.top;
    state.currentMousePos = currentMousePos;

    // Update metro line editing interactions.
    if (state.activeLine && isDragging) {
      if (state.activeLine.editingMode === "new") {
        let snapped = getSnappedStation(
          currentMousePos.x,
          currentMousePos.y,
          stations
        );
        if (snapped) {
          let arr = state.activeLine.stations;
          if (snapped.id === arr[0].id && arr.length >= 2) {
            if (arr[arr.length - 1].id !== snapped.id) arr.push(snapped);
          } else {
            if (arr.length > 1 && arr[arr.length - 2].id === snapped.id) {
              arr.pop();
            } else if (!arr.some((s) => s.id === snapped.id)) {
              arr.push(snapped);
            }
          }
        }
      } else if (state.activeLine.editingMode === "modify") {
        let candidate = getSnappedStation(
          currentMousePos.x,
          currentMousePos.y,
          stations
        );
        if (candidate) {
          state.activeLine.modifyCursor = { x: candidate.x, y: candidate.y };
          state.activeLine.modifyCandidate = candidate;
        } else {
          state.activeLine.modifyCursor = {
            x: currentMousePos.x,
            y: currentMousePos.y,
          };
          state.activeLine.modifyCandidate = null;
        }
      } else if (state.activeLine.editingMode === "extend") {
        let candidate = getSnappedStation(
          currentMousePos.x,
          currentMousePos.y,
          stations
        );
        if (candidate) {
          state.activeLine.extendCursor = { x: candidate.x, y: candidate.y };
          state.activeLine.extendCandidate = candidate;
        } else {
          state.activeLine.extendCursor = {
            x: currentMousePos.x,
            y: currentMousePos.y,
          };
          state.activeLine.extendCandidate = null;
        }
      }
    }

    // ---- Update hold animation progress for station creation & removal ----
    // TODO I don't think we need this
    // const now = Date.now();
    // if (state.stationCreationAnimation) {
    //   const elapsed = now - state.stationCreationAnimation.startTime;
    //   state.stationCreationAnimation.progress = Math.min(
    //     elapsed / holdThreshold,
    //     1
    //   );
    //   // Your render loop can use this progress (e.g. scaling the station circle)
    // }
    // if (state.stationRemovalAnimation) {
    //   const elapsed = now - state.stationRemovalAnimation.startTime;
    //   state.stationRemovalAnimation.progress = Math.min(
    //     elapsed / holdThreshold,
    //     1
    //   );
    //   // Use this progress to increase shaking amplitude, etc.
    // }
  });

  canvas.addEventListener("mouseup", (e) => {
    isDragging = false;
    // Cancel any pending station hold actions if the hold was released early.
    if (stationCreationHoldTimer) {
      clearTimeout(stationCreationHoldTimer);
      stationCreationHoldTimer = null;
      state.stationCreationAnimation = null;
    }
    if (stationRemovalHoldTimer) {
      clearTimeout(stationRemovalHoldTimer);
      stationRemovalHoldTimer = null;
      state.stationRemovalAnimation = null;
    }

    if (state.activeLine) {
      if (state.activeLine.editingMode === "modify") {
        let idx = state.activeLine.modifySegmentIndex;
        let X = state.activeLine.originalStations[idx];
        let Y = state.activeLine.originalStations[idx + 1];
        let minStations = state.activeLine.isLoop ? 3 : 2;
        if (state.activeLine.modifyCandidate) {
          if (
            (state.activeLine.modifyCandidate.id === X.id ||
              state.activeLine.modifyCandidate.id === Y.id) &&
            state.activeLine.originalStations.length > minStations
          ) {
            state.activeLine.stations =
              state.activeLine.originalStations.slice();
            if (state.activeLine.modifyCandidate.id === X.id) {
              state.activeLine.stations.splice(idx, 1);
            } else {
              state.activeLine.stations.splice(idx + 1, 1);
            }
          } else if (
            state.activeLine.modifyCandidate.id !== X.id &&
            state.activeLine.modifyCandidate.id !== Y.id
          ) {
            if (
              !state.activeLine.originalStations.some(
                (s) => s.id === state.activeLine.modifyCandidate.id
              )
            ) {
              state.activeLine.stations =
                state.activeLine.originalStations.slice();
              state.activeLine.stations.splice(
                idx + 1,
                0,
                state.activeLine.modifyCandidate
              );
            } else {
              state.activeLine.stations =
                state.activeLine.originalStations.slice();
            }
          } else {
            state.activeLine.stations =
              state.activeLine.originalStations.slice();
          }
        }
        state.activeLine.editingMode = "new";
        state.activeLine = null;
        recalcCommuterRoutesCallback();
      } else if (state.activeLine.editingMode === "extend") {
        if (state.activeLine.extendCandidate) {
          if (state.activeLine.extendEnd === "end") {
            if (
              state.activeLine.extendCandidate.id ===
                state.activeLine.stations[0].id &&
              state.activeLine.stations.length >= 2
            ) {
              state.activeLine.stations.push(state.activeLine.extendCandidate);
              state.activeLine.isLoop = true;
            } else if (
              !state.activeLine.stations.some(
                (s) => s.id === state.activeLine.extendCandidate.id
              )
            ) {
              state.activeLine.stations.push(state.activeLine.extendCandidate);
            }
          } else if (state.activeLine.extendEnd === "start") {
            if (
              state.activeLine.extendCandidate.id ===
                state.activeLine.stations[state.activeLine.stations.length - 1]
                  .id &&
              state.activeLine.stations.length >= 2
            ) {
              state.activeLine.stations.unshift(
                state.activeLine.extendCandidate
              );
              state.activeLine.isLoop = true;
            } else if (
              !state.activeLine.stations.some(
                (s) => s.id === state.activeLine.extendCandidate.id
              )
            ) {
              state.activeLine.stations.unshift(
                state.activeLine.extendCandidate
              );
            }
          }
        }
        state.activeLine = null;
        recalcCommuterRoutesCallback();
      } else if (state.activeLine.editingMode === "new") {
        // Finalize the new train line on mouseup.
        if (state.activeLine.stations.length >= 2) {
          if (
            state.activeLine.stations[0].id ===
              state.activeLine.stations[state.activeLine.stations.length - 1]
                .id &&
            state.activeLine.stations.length >= 3
          ) {
            state.activeLine.isLoop = true;
          } else {
            state.activeLine.isLoop = false;
          }
          metroLines.push(state.activeLine);
          spawnDefaultTrains(state.activeLine);
          recalcCommuterRoutesCallback();
        }
        state.activeLine = null;
      }
    }
  });

  // Remove dblclick and contextmenu listeners; station and line actions are now managed via hold and mouseup.

  canvas.addEventListener("click", (e) => {
    // Existing commuter pinning functionality.
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
