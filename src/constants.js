// constants.js
export const canvasWidth = 800;
export const canvasHeight = 600;

// Use a 2:1 ratio for grid cells (e.g. 100 x 50)
export const gridSpacingX = 100;
export const gridSpacingY = 50;

// Metro/Train constants:
export const acceleration = 0.0005;
export const maxSpeed = 1.0; // px/frame
export const dwellTime = 2000;

// Station and drawing constants:
export const stationRadius = 15;
export const snapThreshold = 20;
export const tabMargin = 10;
export const tabRadius = 6;

// Commuter/Walking constants:
export const commuterSpawnInterval = 1500;
export const walkingSpeed = 0.05; // px/frame

// Other constants:
export const maxStationCount = 26;
export const metroWaitTime = dwellTime / 2;
export const transferTime = 3000;

// Creation / deletion
export const holdThreshold = 1000; // milliseconds required for hold actions
