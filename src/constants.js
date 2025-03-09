// constants.js
export const canvasWidth = 500;
export const canvasHeight = 850;

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
export const tabMargin = 15;
export const tabClickRadius = 20;

// Commuter/Walking constants:
export const commuterSpawnInterval = 1500;
export const walkingSpeed = 0.05; // px/frame

// Other constants:
export const maxStationCount = 26;
export const metroWaitTime = dwellTime / 2;
export const transferTime = 3000;

// Creation / deletion
export const holdThreshold = 1000; // milliseconds required for hold actions

// Mapping of color names to hex values
export const COLORS = {
  red: "#ff0000",
  blue: "#0000ff",
  green: "#00ff00",
  yellow: "#ffff00",
  purple: "#800080",
  orange: "#ffa500",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  brown: "#8b4513",
  black: "#000000",
};

// Optional: Reverse mapping of hex values to color names
export const COLOR_NAMES = Object.fromEntries(
  Object.entries(COLORS).map(([name, hex]) => [hex, name])
);
