var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// index.ts
import { distance } from "@turf/distance";
import { flattenEach } from "@turf/meta";
import {
  point,
  degreesToRadians,
  radiansToDegrees
} from "@turf/helpers";
import { getCoord, getCoords } from "@turf/invariant";
function nearestPointOnLine(lines, inputPoint, options = {}) {
  if (!lines || !inputPoint) {
    throw new Error("lines and inputPoint are required arguments");
  }
  const inputPos = getCoord(inputPoint);
  let closestPt = point([Infinity, Infinity], {
    lineStringIndex: -1,
    segmentIndex: -1,
    totalDistance: -1,
    lineDistance: -1,
    segmentDistance: -1,
    pointDistance: Infinity,
    // deprecated properties START
    multiFeatureIndex: -1,
    index: -1,
    location: -1,
    dist: Infinity
    // deprecated properties END
  });
  let totalDistance = 0;
  let lineDistance = 0;
  let currentLineStringIndex = -1;
  flattenEach(
    lines,
    function(line, _featureIndex, lineStringIndex) {
      if (currentLineStringIndex !== lineStringIndex) {
        currentLineStringIndex = lineStringIndex;
        lineDistance = 0;
      }
      const coords = getCoords(line);
      for (let i = 0; i < coords.length - 1; i++) {
        const start = point(coords[i]);
        const startPos = getCoord(start);
        const stop = point(coords[i + 1]);
        const stopPos = getCoord(stop);
        const segmentLength = distance(start, stop, options);
        let intersectPos;
        let wasEnd;
        if (stopPos[0] === inputPos[0] && stopPos[1] === inputPos[1]) {
          [intersectPos, wasEnd] = [stopPos, true];
        } else if (startPos[0] === inputPos[0] && startPos[1] === inputPos[1]) {
          [intersectPos, wasEnd] = [startPos, false];
        } else {
          [intersectPos, wasEnd] = nearestPointOnSegment(
            startPos,
            stopPos,
            inputPos
          );
        }
        const pointDistance = distance(inputPoint, intersectPos, options);
        if (pointDistance < closestPt.properties.pointDistance) {
          const segmentDistance = distance(start, intersectPos, options);
          closestPt = point(intersectPos, {
            lineStringIndex,
            // Legacy behaviour where index progresses to next segment # if we
            // went with the end point this iteration.
            segmentIndex: wasEnd ? i + 1 : i,
            totalDistance: totalDistance + segmentDistance,
            lineDistance: lineDistance + segmentDistance,
            segmentDistance,
            pointDistance,
            // deprecated properties START
            multiFeatureIndex: -1,
            index: -1,
            location: -1,
            dist: Infinity
            // deprecated properties END
          });
          closestPt.properties = __spreadProps(__spreadValues({}, closestPt.properties), {
            multiFeatureIndex: closestPt.properties.lineStringIndex,
            index: closestPt.properties.segmentIndex,
            location: closestPt.properties.totalDistance,
            dist: closestPt.properties.pointDistance
            // deprecated properties END
          });
        }
        totalDistance += segmentLength;
        lineDistance += segmentLength;
      }
    }
  );
  return closestPt;
}
function dot(v1, v2) {
  const [v1x, v1y, v1z] = v1;
  const [v2x, v2y, v2z] = v2;
  return v1x * v2x + v1y * v2y + v1z * v2z;
}
function cross(v1, v2) {
  const [v1x, v1y, v1z] = v1;
  const [v2x, v2y, v2z] = v2;
  return [v1y * v2z - v1z * v2y, v1z * v2x - v1x * v2z, v1x * v2y - v1y * v2x];
}
function magnitude(v) {
  return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2) + Math.pow(v[2], 2));
}
function normalize(v) {
  const mag = magnitude(v);
  return [v[0] / mag, v[1] / mag, v[2] / mag];
}
function lngLatToVector(a) {
  const lat = degreesToRadians(a[1]);
  const lng = degreesToRadians(a[0]);
  return [
    Math.cos(lat) * Math.cos(lng),
    Math.cos(lat) * Math.sin(lng),
    Math.sin(lat)
  ];
}
function vectorToLngLat(v) {
  const [x, y, z] = v;
  const zClamp = Math.min(Math.max(z, -1), 1);
  const lat = radiansToDegrees(Math.asin(zClamp));
  const lng = radiansToDegrees(Math.atan2(y, x));
  return [lng, lat];
}
function nearestPointOnSegment(posA, posB, posC) {
  const A = lngLatToVector(posA);
  const B = lngLatToVector(posB);
  const C = lngLatToVector(posC);
  const segmentAxis = cross(A, B);
  if (segmentAxis[0] === 0 && segmentAxis[1] === 0 && segmentAxis[2] === 0) {
    if (dot(A, B) > 0) {
      return [[...posB], true];
    } else {
      return [[...posC], false];
    }
  }
  const targetAxis = cross(segmentAxis, C);
  if (targetAxis[0] === 0 && targetAxis[1] === 0 && targetAxis[2] === 0) {
    return [[...posB], true];
  }
  const intersectionAxis = cross(targetAxis, segmentAxis);
  const I1 = normalize(intersectionAxis);
  const I2 = [-I1[0], -I1[1], -I1[2]];
  const I = dot(C, I1) > dot(C, I2) ? I1 : I2;
  const segmentAxisNorm = normalize(segmentAxis);
  const cmpAI = dot(cross(A, I), segmentAxisNorm);
  const cmpIB = dot(cross(I, B), segmentAxisNorm);
  if (cmpAI >= 0 && cmpIB >= 0) {
    return [vectorToLngLat(I), false];
  }
  if (dot(A, C) > dot(B, C)) {
    return [[...posA], false];
  } else {
    return [[...posB], true];
  }
}
var index_default = nearestPointOnLine;
export {
  index_default as default,
  nearestPointOnLine
};
//# sourceMappingURL=index.js.map