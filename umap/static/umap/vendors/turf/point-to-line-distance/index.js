// index.ts
import {
  convertLength,
  feature,
  lineString,
  point
} from "@turf/helpers";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import { featureOf } from "@turf/invariant";
import { segmentEach } from "@turf/meta";
import { rhumbDistance } from "@turf/rhumb-distance";
function pointToLineDistance(pt, line, options = {}) {
  var _a, _b;
  const method = (_a = options.method) != null ? _a : "geodesic";
  const units = (_b = options.units) != null ? _b : "kilometers";
  if (!pt) {
    throw new Error("pt is required");
  }
  if (Array.isArray(pt)) {
    pt = point(pt);
  } else if (pt.type === "Point") {
    pt = feature(pt);
  } else {
    featureOf(pt, "Point", "point");
  }
  if (!line) {
    throw new Error("line is required");
  }
  if (Array.isArray(line)) {
    line = lineString(line);
  } else if (line.type === "LineString") {
    line = feature(line);
  } else {
    featureOf(line, "LineString", "line");
  }
  let distance = Infinity;
  const p = pt.geometry.coordinates;
  segmentEach(line, (segment) => {
    if (segment) {
      const a = segment.geometry.coordinates[0];
      const b = segment.geometry.coordinates[1];
      const d = distanceToSegment(p, a, b, { method });
      if (d < distance) {
        distance = d;
      }
    }
  });
  return convertLength(distance, "degrees", units);
}
function distanceToSegment(p, a, b, options) {
  if (options.method === "geodesic") {
    const nearest = nearestPointOnLine(lineString([a, b]).geometry, p, {
      units: "degrees"
    });
    return nearest.properties.pointDistance;
  }
  const v = [b[0] - a[0], b[1] - a[1]];
  const w = [p[0] - a[0], p[1] - a[1]];
  const c1 = dot(w, v);
  if (c1 <= 0) {
    return rhumbDistance(p, a, { units: "degrees" });
  }
  const c2 = dot(v, v);
  if (c2 <= c1) {
    return rhumbDistance(p, b, { units: "degrees" });
  }
  const b2 = c1 / c2;
  const Pb = [a[0] + b2 * v[0], a[1] + b2 * v[1]];
  return rhumbDistance(p, Pb, { units: "degrees" });
}
function dot(u, v) {
  return u[0] * v[0] + u[1] * v[1];
}
var index_default = pointToLineDistance;
export {
  index_default as default,
  pointToLineDistance
};
//# sourceMappingURL=index.js.map