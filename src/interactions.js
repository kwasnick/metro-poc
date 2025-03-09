// interactions.js
import {
  getStationAt,
  getSnappedStation,
  distance,
  distanceToSegment,
  computeTabPosition,
  generateRandomStationId,
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
  recalcCommuterRoutesFunc,
  stationIcon
) {
  const { lineColorDropdown, deleteLineButton } = uiElements;

  function recalcCommuterRoutesCallback() {
    recalcCommuterRoutesFunc(commuters, gridNodes, metroLines);
  }

  function getXY(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;
    return { x, y };
  }

  // ---- New Hold Parameters ----
  let stationRemovalHoldTimer = null;

  // New constant: if the mouse moves farther than this (in pixels) from the original point, cancel the hold.
  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const effectiveHoldThreshold = isTouchDevice
    ? holdThreshold * 1.2
    : holdThreshold;
  const holdCancelThreshold = isTouchDevice ? 25 : 20;

  // Animation states for station creation/removal.
  state.stationRemovalAnimation = null; // { station, startTime, progress }

  deleteLineButton.addEventListener("click", () => {
    metroLines.splice(
      metroLines.findIndex((line) => line.color === lineColorDropdown.value),
      1
    );
    recalcCommuterRoutesCallback();
  });

  let isDragging = false;
  let currentMousePos = { x: 0, y: 0 };

  canvas.addEventListener("mousedown", (e) => {
    currentMousePos = getXY(e);
    let { x, y } = currentMousePos;
    state.currentMousePos = currentMousePos;

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

      // (B) Check if clicking on an existing station for removal or (now) line creation.
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
    currentMousePos = getXY(e);
    state.currentMousePos = currentMousePos;

    // NEW: If dragging from a clicked station (set for removal) beyond the threshold,
    // cancel the removal hold and start new line creation mode.
    if (state.stationRemovalAnimation) {
      const origin = state.stationRemovalAnimation.station;
      if (
        distance(currentMousePos.x, currentMousePos.y, origin.x, origin.y) >
        holdCancelThreshold
      ) {
        clearTimeout(stationRemovalHoldTimer);
        stationRemovalHoldTimer = null;
        state.stationRemovalAnimation = null;
        // Enter new line creation mode using the clicked station.
        state.activeLine = {
          id: state.nextLineId++,
          color: lineColorDropdown.value,
          stations: [origin],
          trains: [],
          editingMode: "new",
        };
      }
    }

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
  });

  canvas.addEventListener("mouseup", (e) => {
    isDragging = false;
    // Cancel any pending station hold actions if the hold was released early.
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
            // remove the last element, which is a duplicate
            state.activeLine.stations.pop();
          } else {
            state.activeLine.isLoop = false;
          }
          metroLines.push(state.activeLine);
          spawnDefaultTrains(state.activeLine);
          recalcCommuterRoutesCallback();

          // *** Auto-advance the color picker ***
          const colorDropdown = document.getElementById("lineColorDropdown");
          colorDropdown.selectedIndex =
            (colorDropdown.selectedIndex + 1) % colorDropdown.options.length;
        }
        state.activeLine = null;
      }
    }
  });

  canvas.addEventListener("click", (e) => {
    // Existing commuter pinning functionality.
    if (state.activeLine) return;
    currentMousePos = getXY(e);
    let { x, y } = currentMousePos;
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

  let touchStartX, touchStartY, touchStartTime;

  // Add touch event listeners for mobile devices.
  canvas.addEventListener(
    "touchstart",
    function (e) {
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      e.preventDefault();
      let simulatedEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      canvas.dispatchEvent(simulatedEvent);
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    function (e) {
      e.preventDefault();
      let touch = e.touches[0];
      let simulatedEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      canvas.dispatchEvent(simulatedEvent);
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    function (e) {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;

      // If movement is small and duration short, treat it as a click.
      if (Math.hypot(dx, dy) < 10 && dt < 300) {
        let clickEvent = new MouseEvent("click", {
          clientX: touch.clientX,
          clientY: touch.clientY,
          bubbles: true,
          cancelable: true,
          button: 0,
        });
        canvas.dispatchEvent(clickEvent);
      }

      // Also dispatch mouseup if needed.
      let simulatedEvent = new MouseEvent("mouseup", {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      canvas.dispatchEvent(simulatedEvent);
    },
    { passive: false }
  );

  // ---------------------------
  // Desktop Drag-and-Drop Setup
  // ---------------------------
  stationIcon.addEventListener("dragstart", (e) => {
    // Set a data payload (if needed for visual cues)
    e.dataTransfer.setData("text/plain", "station");
  });

  canvas.addEventListener("dragover", (e) => {
    e.preventDefault(); // Allow drop
  });

  canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    // Convert drop event coordinates to canvas coordinates
    let dropPos = getXY(e);
    handleStationDrop(dropPos);
  });

  // ---------------------------
  // Mobile Drag Simulation Setup
  // ---------------------------
  let mobileStationGhost = null; // A floating copy of the station icon for visual feedback

  stationIcon.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      // Create a ghost element for visual feedback during the drag
      mobileStationGhost = stationIcon.cloneNode(true);
      mobileStationGhost.style.position = "absolute";
      mobileStationGhost.style.opacity = "0.7";
      mobileStationGhost.style.pointerEvents = "none";
      // Append it to the body so it can move freely
      document.body.appendChild(mobileStationGhost);
      // Position the ghost at the initial touch point
      let touch = e.touches[0];
      mobileStationGhost.style.left = touch.clientX + "px";
      mobileStationGhost.style.top = touch.clientY + "px";
    },
    { passive: false }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!mobileStationGhost) return;
      e.preventDefault();
      // Update ghost position with the touch
      let touch = e.touches[0];
      mobileStationGhost.style.left = touch.clientX + "px";
      mobileStationGhost.style.top = touch.clientY + "px";
    },
    { passive: false }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (!mobileStationGhost) return;
      e.preventDefault();
      // Use the changedTouches to determine the final drop location
      let touch = e.changedTouches[0];
      let dropPos = getXY({ clientX: touch.clientX, clientY: touch.clientY });

      // Remove the ghost element
      document.body.removeChild(mobileStationGhost);
      mobileStationGhost = null;

      // Only process the drop if the touch ended over the canvas area.
      let canvasRect = canvas.getBoundingClientRect();
      if (
        touch.clientX >= canvasRect.left &&
        touch.clientX <= canvasRect.right &&
        touch.clientY >= canvasRect.top &&
        touch.clientY <= canvasRect.bottom
      ) {
        handleStationDrop(dropPos);
      }
    },
    { passive: false }
  );

  // ---------------------------
  // Common Drop Logic
  // ---------------------------
  function handleStationDrop(dropPos) {
    // Find the nearest grid node to the drop position
    let closest = null,
      bestDist = Infinity;
    for (let key in gridNodes) {
      let node = gridNodes[key];
      let d = distance(dropPos.x, dropPos.y, node.x, node.y);
      if (d < bestDist) {
        bestDist = d;
        closest = node;
      }
    }
    // Check if the drop is within the snapping threshold
    if (closest && bestDist < snapThreshold) {
      // Ensure no station already exists at this grid node
      let exists = stations.find(
        (s) => s.col === closest.col && s.row === closest.row
      );
      if (!exists) {
        let stationId = generateRandomStationId();
        // Make sure the ID is unique
        while (stations.some((station) => station.id === stationId)) {
          stationId = generateRandomStationId();
        }
        let newStation = {
          id: stationId,
          x: closest.x,
          y: closest.y,
          col: closest.col,
          row: closest.row,
        };
        stations.push(newStation);
        // Update routes for commuters after adding a station
        recalcCommuterRoutesCallback();
      }
    }
  }
}
