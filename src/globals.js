// globals.js
export let stations = []; // { id, x, y, col, row }
export let metroLines = []; // { id, color, stations: [...], trains: [], isLoop }
export let commuters = []; // Commuters and their routing state

// For ID generation:
export let nextLineId = 1;
export let nextTrainId = 1;
export let nextCommuterId = 1;

export let arrivalEffects = []; // { x, y, startTime }
export let boardEffects = [];

// Pin state for UI:
export let pinnedCommuter = null;
