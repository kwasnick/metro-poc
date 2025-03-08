// background.js
import {
  gridSpacingX,
  gridSpacingY,
  canvasWidth,
  canvasHeight,
} from "./constants.js";

// Helper: checks if two rectangles overlap considering a minimum gap.
function rectanglesOverlapWithMargin(r1, r2, margin) {
  return !(
    r2.x >= r1.x + r1.width + margin ||
    r2.x + r2.width + margin <= r1.x ||
    r2.y >= r1.y + r1.height + margin ||
    r2.y + r2.height + margin <= r1.y
  );
}

export function createBackground(bgCanvas) {
  const bgCtx = bgCanvas.getContext("2d");

  // Clear the background.
  bgCtx.fillStyle = "#ffffff";
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  // Define margins.
  const cellMargin = 5; // Margin between the buildings area and the cell edges (i.e. street margin)
  const buildingMargin = 2; // Minimum gap between individual buildings

  // Available drawing area within each cell.
  const availWidth = gridSpacingX - 2 * cellMargin;
  const availHeight = gridSpacingY - 2 * cellMargin;
  const cellArea = availWidth * availHeight;
  const targetFillRatio = 0.9; // Fill at least 90% of the available area.
  const targetFill = targetFillRatio * cellArea;

  // Building size constraints (as a percentage of the available cell dimensions).
  const minWidthPercent = 0.05; // 5% of availWidth
  const maxWidthPercent = 0.25; // 25% of availWidth
  const minHeightPercent = 0.2; // 20% of availHeight
  const maxHeightPercent = 0.75; // up to 80% of availHeight; if above, force full height.
  const fullHeightForceThreshold = 0.7;

  const cols = Math.floor(canvasWidth / gridSpacingX);
  const rows = Math.floor(canvasHeight / gridSpacingY);

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const cellLeft = col * gridSpacingX;
      const cellTop = row * gridSpacingY;
      const availX = cellLeft + cellMargin;
      const availY = cellTop + cellMargin;

      let placedBuildings = [];
      let filledArea = 0;
      let attempts = 0;
      // Try placing buildings until we fill at least 90% of the cell area,
      // or until we hit a maximum number of attempts.
      while (filledArea < targetFill && attempts < 10000) {
        attempts++;

        // Randomly choose building width.
        const minBuildingWidth = availWidth * minWidthPercent;
        const maxBuildingWidth = availWidth * maxWidthPercent;
        let buildingWidth =
          minBuildingWidth +
          Math.random() * (maxBuildingWidth - minBuildingWidth);
        buildingWidth = Math.min(buildingWidth, availWidth);

        // Randomly choose building height.
        const minBuildingHeight = availHeight * minHeightPercent;
        const maxBuildingHeight = availHeight * maxHeightPercent;
        let buildingHeight =
          minBuildingHeight +
          Math.random() * (maxBuildingHeight - minBuildingHeight);
        // If the height exceeds 80% of the available height, force full available height.
        if (buildingHeight > availHeight * fullHeightForceThreshold) {
          buildingHeight = availHeight;
        }
        buildingHeight = Math.min(buildingHeight, availHeight);

        // Randomly choose an edge: 0 = left, 1 = top, 2 = right, 3 = bottom.
        const edge = Math.floor(Math.random() * 4);
        let posX, posY;
        if (edge === 0) {
          // Anchored to left.
          posX = availX;
          posY = availY + Math.random() * (availHeight - buildingHeight);
        } else if (edge === 1) {
          // Anchored to top.
          posY = availY;
          posX = availX + Math.random() * (availWidth - buildingWidth);
        } else if (edge === 2) {
          // Anchored to right.
          posX = availX + (availWidth - buildingWidth);
          posY = availY + Math.random() * (availHeight - buildingHeight);
        } else {
          // Anchored to bottom.
          posY = availY + (availHeight - buildingHeight);
          posX = availX + Math.random() * (availWidth - buildingWidth);
        }

        const newBuilding = {
          x: posX,
          y: posY,
          width: buildingWidth,
          height: buildingHeight,
        };

        // Check overlap with existing buildings using the building margin.
        const overlaps = placedBuildings.some((b) =>
          rectanglesOverlapWithMargin(b, newBuilding, buildingMargin)
        );
        if (!overlaps) {
          placedBuildings.push(newBuilding);
          filledArea += buildingWidth * buildingHeight;
        }
      } // end while for cell

      // Draw the buildings in the cell.
      placedBuildings.forEach((b) => {
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
  // Vertical grid lines.
  for (let x = 0; x <= bgCanvas.width; x += gridSpacingX) {
    bgCtx.beginPath();
    bgCtx.moveTo(x, 0);
    bgCtx.lineTo(x, bgCanvas.height);
    bgCtx.stroke();
  }
  // Horizontal grid lines.
  for (let y = 0; y <= bgCanvas.height; y += gridSpacingY) {
    bgCtx.beginPath();
    bgCtx.moveTo(0, y);
    bgCtx.lineTo(bgCanvas.width, y);
    bgCtx.stroke();
  }
  bgCtx.restore();
}
