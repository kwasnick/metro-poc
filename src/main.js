// main.js
import { canvasWidth, canvasHeight, gridSpacing, commuterSpawnInterval } from "./constants.js";
import { stations, metroLines, commuters, arrivedCount } from "./globals.js";
import { createBackground } from "./background.js";
import { spawnDefaultTrains } from "./trains.js";
import { spawnCommuter, updateCommuters } from "./commuters.js";
import { updateTrains } from "./trains.js";
import { draw } from "./drawing.js";
import { setupInteractions } from "./interactions.js";

// Initialize canvas
const canvas = document.getElementById("gameCanvas");
canvas.width = canvasWidth;
canvas.height = canvasHeight;
const ctx = canvas.getContext("2d");

// Create offscreen background
const bgCanvas = document.createElement("canvas");
bgCanvas.width = canvas.width;
bgCanvas.height = canvas.height;
createBackground(bgCanvas);

// Setup UI elements
const lineColorDropdown = document.getElementById("lineColorDropdown");
const newLineButton = document.getElementById("newLineButton");
const deleteLineButton = document.getElementById("deleteLineButton");
const counterDiv = document.getElementById("counter");
const trainPopup = document.getElementById("trainPopup");
const uiElements = { lineColorDropdown, newLineButton, deleteLineButton, counterDiv, trainPopup };

// Global state object for interactions
const state = {
  activeLine: null,
  nextLineId: 1,
  nextTrainId: 1,
  pinnedCommuter: null,
  currentMousePos: { x: 0, y: 0 }
};

// Create grid nodes for path planning:
let gridNodes = {};
const canvasCols = Math.floor(canvas.width / gridSpacing) + 1;
const canvasRows = Math.floor(canvas.height / gridSpacing) + 1;
for (let col = 0; col < canvasCols; col++) {
  for (let row = 0; row < canvasRows; row++) {
    let key = col + "," + row;
    gridNodes[key] = { col, row, x: col * gridSpacing, y: row * gridSpacing };
  }
}

// Dummy recalc function – implement as needed.
function recalcCommuterRoutes() {
  // Recalculate routes for all commuters based on the current grid and metro configuration.
}

// Setup mouse and UI interactions:
setupInteractions(canvas, uiElements, state, gridNodes, stations, metroLines, commuters, recalcCommuterRoutes);

// Main update loop
function update(now) {
  updateTrains(metroLines, now);
  updateCommuters(commuters, metroLines, gridNodes, now);
  draw(ctx, bgCanvas, metroLines, state.activeLine, state.currentMousePos, stations, commuters, state.pinnedCommuter, null, /*hoveredCommuter*/ [], now);
  counterDiv.textContent = "Arrived: " + arrivedCount;
  requestAnimationFrame(update);
}

// Spawn commuters at intervals:
setInterval(() => {
  spawnCommuter(gridNodes, metroLines, commuters, { value: state.nextCommuterId });
}, commuterSpawnInterval);

requestAnimationFrame(update);
