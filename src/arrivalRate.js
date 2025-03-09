// arrivalRate.js

// Array to store timestamps (in milliseconds) for each arrival.
let arrivalTimestamps = [];

/**
 * Call this function each time an arrival occurs.
 */
export function recordArrival() {
  const now = performance.now();
  arrivalTimestamps.push(now);
  // Clean up timestamps older than 10 seconds
  removeOldArrivals(now);
}

/**
 * Remove arrival timestamps older than 10 seconds.
 * @param {number} now - Current timestamp in ms.
 */
function removeOldArrivals(now) {
  const cutoff = now - 10000; // 10 seconds window
  // Remove outdated timestamps from the front of the array
  while (arrivalTimestamps.length && arrivalTimestamps[0] < cutoff) {
    arrivalTimestamps.shift();
  }
}

/**
 * Returns the current arrival rate as a rolling average.
 * This gives the average arrivals per second over the last 10 seconds.
 * @returns {number} Arrival rate (arrivals per second)
 */
export function getArrivalRate() {
  const now = performance.now();
  removeOldArrivals(now);
  // Compute average arrivals per second: count in 10 sec divided by 10.
  return arrivalTimestamps.length / 10;
}

/**
 * Optional: Resets the arrival tracking.
 */
export function resetArrivalRate() {
  arrivalTimestamps = [];
}
