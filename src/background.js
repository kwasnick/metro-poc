// background.js
import { gridSpacing, canvasWidth, canvasHeight } from "./constants.js";

function rectanglesOverlap(r1, r2) {
  return !(
    r2.x >= r1.x + r1.width ||
    r2.x + r2.width <= r1.x ||
    r2.y >= r1.y + r1.height ||
    r2.y + r2.height <= r1.y
  );
}

export function createBackground(bgCanvas) {
  const bgCtx = bgCanvas.getContext("2d");
  
  // Clear background.
  bgCtx.fillStyle = "#ffffff";
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  
  // Parameters for each grid cell.
  const cellMargin = 5;  // margin inside each grid cell (keeps buildings off grid lines)
  const availWidth = gridSpacing - 2 * cellMargin;
  const availHeight = gridSpacing - 2 * cellMargin;
  const cellArea = availWidth * availHeight;
  const targetFillRatio = 0.6; // we aim to fill 60% of the cell's area with buildings
  const targetFill = targetFillRatio * cellArea;
  
  // Parameters for building size:
  // For small buildings (most cases)
  const smallProb = 0.9;         // 90% chance for a small building.
  const smallMin = 3;
  const smallMax = 8;
  // For big buildings (rare)
  const bigMin = Math.min(availWidth, availHeight) * 0.5; // at least half the available size
  const bigMax = Math.min(availWidth, availHeight);        // can fill nearly the whole cell
  
  // Determine grid cell count.
  const cols = Math.floor(bgCanvas.width / gridSpacing);
  const rows = Math.floor(bgCanvas.height / gridSpacing);
  
  // Process each cell.
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const cellLeft = col * gridSpacing;
      const cellTop = row * gridSpacing;
      const availX = cellLeft + cellMargin;
      const availY = cellTop + cellMargin;
      
      let placedBuildings = [];
      let filledArea = 0;
      let attempts = 0;
      // Continue trying until we reach the target fill or hit a maximum number of attempts.
      while (filledArea < targetFill && attempts < 200) {
        attempts++;
        // Decide randomly: small (90%) or big (10%) building.
        const isSmall = Math.random() < smallProb;
        let minSize = isSmall ? smallMin : bigMin;
        let maxSize = isSmall ? smallMax : bigMax;
        
        // Randomly choose one edge: 0 = left, 1 = top, 2 = right, 3 = bottom.
        const edge = Math.floor(Math.random() * 4);
        let building = null;
        
        if (edge === 0) { // Anchored to the left edge.
          let width = minSize + Math.random() * (maxSize - minSize);
          // Constrain width so it does not exceed available width.
          width = Math.min(width, availWidth);
          let height = minSize + Math.random() * (maxSize - minSize);
          height = Math.min(height, availHeight);
          let y = availY + Math.random() * (availHeight - height);
          building = { x: availX, y, width, height, edge: 'left' };
        } else if (edge === 1) { // Anchored to the top edge.
          let height = minSize + Math.random() * (maxSize - minSize);
          height = Math.min(height, availHeight);
          let width = minSize + Math.random() * (maxSize - minSize);
          width = Math.min(width, availWidth);
          let x = availX + Math.random() * (availWidth - width);
          building = { x, y: availY, width, height, edge: 'top' };
        } else if (edge === 2) { // Anchored to the right edge.
          let width = minSize + Math.random() * (maxSize - minSize);
          width = Math.min(width, availWidth);
          let height = minSize + Math.random() * (maxSize - minSize);
          height = Math.min(height, availHeight);
          let x = availX + availWidth - width;
          let y = availY + Math.random() * (availHeight - height);
          building = { x, y, width, height, edge: 'right' };
        } else if (edge === 3) { // Anchored to the bottom edge.
          let height = minSize + Math.random() * (maxSize - minSize);
          height = Math.min(height, availHeight);
          let width = minSize + Math.random() * (maxSize - minSize);
          width = Math.min(width, availWidth);
          let y = availY + availHeight - height;
          let x = availX + Math.random() * (availWidth - width);
          building = { x, y, width, height, edge: 'bottom' };
        }
        
        // Check if this building overlaps any already placed building.
        const overlaps = placedBuildings.some(b => rectanglesOverlap(b, building));
        if (!overlaps) {
          placedBuildings.push(building);
          filledArea += building.width * building.height;
        }
      }
      
      // Draw the buildings for this cell.
      placedBuildings.forEach(b => {
        // Use a random gray tone.
        const gray = Math.floor(150 + Math.random() * 100);
        bgCtx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        bgCtx.fillRect(b.x, b.y, b.width, b.height);
      });
    }
  }
  
  // Draw the road grid lines on top.
  bgCtx.save();
  bgCtx.strokeStyle = "#e0e0e0";
  bgCtx.lineWidth = 1;
  
  // Vertical lines.
  for (let x = 0; x <= bgCanvas.width; x += gridSpacing) {
    bgCtx.beginPath();
    bgCtx.moveTo(x, 0);
    bgCtx.lineTo(x, bgCanvas.height);
    bgCtx.stroke();
  }
  // Horizontal lines.
  for (let y = 0; y <= bgCanvas.height; y += gridSpacing) {
    bgCtx.beginPath();
    bgCtx.moveTo(0, y);
    bgCtx.lineTo(bgCanvas.width, y);
    bgCtx.stroke();
  }
  bgCtx.restore();
}
