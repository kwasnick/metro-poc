// main.js
import {
  canvasWidth,
  canvasHeight,
  commuterSpawnInterval,
  defaultSpawnRate,
} from "./constants.js";
import { gridSpacingX, gridSpacingY } from "./constants.js";
import {
  stations,
  metroLines,
  commuters,
  boardEffects,
  arrivalEffects,
} from "./globals.js";
import { roundTo } from "./utils.js";
import { createBackground } from "./background.js";
import { spawnDefaultTrains } from "./trains.js";
import { spawnCommuter, updateCommuters } from "./commuters.js";
import { updateTrains } from "./trains.js";
import { draw } from "./drawing.js";
import { setupInteractions } from "./interactions.js";
import { recalculateRoutes } from "./commuters.js";
import { COLORS } from "./constants.js";
import { getArrivalRate } from "./arrivalRate.js";

// Initialize canvas
const canvas = document.getElementById("gameCanvas");
canvas.width = canvasWidth;
canvas.height = canvasHeight;
const ctx = canvas.getContext("2d");

// Initialize Station Icon
const stationIcon = document.getElementById("stationIcon");

// Create offscreen background
const bgCanvas = document.createElement("canvas");
bgCanvas.width = canvas.width;
bgCanvas.height = canvas.height;
createBackground(bgCanvas);

// Setup UI elements
const lineColorDropdown = document.getElementById("lineColorDropdown");
lineColorDropdown.value = COLORS.red;
const deleteLineButton = document.getElementById("deleteLineButton");
const counterDiv = document.getElementById("counter");
const uiElements = {
  lineColorDropdown,
  deleteLineButton,
  counterDiv,
};

// Global state object for interactions
const state = {
  activeLine: null,
  nextLineId: 1,
  nextTrainId: 1,
  pinnedCommuter: null,
  currentMousePos: { x: 0, y: 0 },
  stationRemovalAnimation: null,
};

// Create grid nodes for path planning:
let gridNodes = {};
const canvasCols = Math.floor(canvasWidth / gridSpacingX) + 1;
const canvasRows = Math.floor(canvasHeight / gridSpacingY) + 1;
for (let col = 0; col < canvasCols; col++) {
  for (let row = 0; row < canvasRows; row++) {
    let key = col + "," + row;
    gridNodes[key] = {
      col,
      row,
      x: col * gridSpacingX,
      y: row * gridSpacingY,
    };
  }
}

// Setup mouse and UI interactions:
setupInteractions(
  canvas,
  uiElements,
  state,
  gridNodes,
  recalculateRoutes,
  stationIcon
);

let highScore = 0;

// Main update loop
function update(now) {
  updateTrains(metroLines, gridNodes, now);
  updateCommuters(commuters, metroLines, gridNodes, now);
  draw(
    ctx,
    bgCanvas,
    metroLines,
    state.activeLine,
    state.currentMousePos,
    stations,
    commuters,
    state.pinnedCommuter,
    arrivalEffects,
    boardEffects,
    now,
    state
  );
  let score = roundTo(getArrivalRate(), 2);
  if (score > highScore) {
    highScore = score;
  }
  counterDiv.textContent = "Score: " + score + " | High Score: " + highScore;
  requestAnimationFrame(update);
}

// Spawn commuters at intervals:

const spawnRateSlider = document.getElementById("spawnRateSlider");
const spawnRateValue = document.getElementById("spawnRateValue");

// Update the displayed value when the slider is moved.
spawnRateSlider.addEventListener("input", () => {
  spawnRateValue.textContent = spawnRateSlider.value;
});
// Replace fixed interval with a dynamic recursive spawner.
function scheduleNextCommuter() {
  spawnCommuter(gridNodes, metroLines, commuters, {
    value: state.nextCommuterId,
  });
  // Read current slider value (in milliseconds)
  let spawnSliderVal = parseInt(spawnRateSlider.value, 10);
  const interval = (commuterSpawnInterval * defaultSpawnRate) / spawnSliderVal;
  setTimeout(scheduleNextCommuter, interval);
}
scheduleNextCommuter();

requestAnimationFrame(update);
