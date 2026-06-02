// index.ts
import { getCoord, getCoords } from "@turf/invariant";
function booleanPointOnLine(pt, line, options = {}) {
  const ptCoords = getCoord(pt);
  const lineCoords = getCoords(line);
  for (let i = 0; i < lineCoords.length - 1; i++) {
    let ignoreBoundary = false;
    if (options.ignoreEndVertices) {
      if (i === 0) {
        ignoreBoundary = "start";
      }
      if (i === lineCoords.length - 2) {
        ignoreBoundary = "end";
      }
      if (i === 0 && i + 1 === lineCoords.length - 1) {
        ignoreBoundary = "both";
      }
    }
    if (isPointOnLineSegment(
      lineCoords[i],
      lineCoords[i + 1],
      ptCoords,
      ignoreBoundary,
      typeof options.epsilon === "undefined" ? null : options.epsilon
    )) {
      return true;
    }
  }
  return false;
}
function isPointOnLineSegment(lineSegmentStart, lineSegmentEnd, pt, excludeBoundary, epsilon) {
  const x = pt[0];
  const y = pt[1];
  const x1 = lineSegmentStart[0];
  const y1 = lineSegmentStart[1];
  const x2 = lineSegmentEnd[0];
  const y2 = lineSegmentEnd[1];
  const dxc = pt[0] - x1;
  const dyc = pt[1] - y1;
  const dxl = x2 - x1;
  const dyl = y2 - y1;
  const cross = dxc * dyl - dyc * dxl;
  if (epsilon !== null) {
    if (Math.abs(cross) > epsilon) {
      return false;
    }
  } else if (cross !== 0) {
    return false;
  }
  if (Math.abs(dxl) === Math.abs(dyl) && Math.abs(dxl) === 0) {
    if (excludeBoundary) {
      return false;
    }
    if (pt[0] === lineSegmentStart[0] && pt[1] === lineSegmentStart[1]) {
      return true;
    } else {
      return false;
    }
  }
  if (!excludeBoundary) {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 <= x && x <= x2 : x2 <= x && x <= x1;
    }
    return dyl > 0 ? y1 <= y && y <= y2 : y2 <= y && y <= y1;
  } else if (excludeBoundary === "start") {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 < x && x <= x2 : x2 <= x && x < x1;
    }
    return dyl > 0 ? y1 < y && y <= y2 : y2 <= y && y < y1;
  } else if (excludeBoundary === "end") {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 <= x && x < x2 : x2 < x && x <= x1;
    }
    return dyl > 0 ? y1 <= y && y < y2 : y2 < y && y <= y1;
  } else if (excludeBoundary === "both") {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 < x && x < x2 : x2 < x && x < x1;
    }
    return dyl > 0 ? y1 < y && y < y2 : y2 < y && y < y1;
  }
  return false;
}
var index_default = booleanPointOnLine;
export {
  booleanPointOnLine,
  index_default as default
};
//# sourceMappingURL=index.js.map