// index.ts
import pip from "point-in-polygon-hao";
import { getCoord, getGeom } from "@turf/invariant";
function booleanPointInPolygon(point, polygon, options = {}) {
  if (!point) {
    throw new Error("point is required");
  }
  if (!polygon) {
    throw new Error("polygon is required");
  }
  const pt = getCoord(point);
  const geom = getGeom(polygon);
  const type = geom.type;
  const bbox = polygon.bbox;
  let polys = geom.coordinates;
  if (bbox && inBBox(pt, bbox) === false) {
    return false;
  }
  if (type === "Polygon") {
    polys = [polys];
  }
  let result = false;
  for (var i = 0; i < polys.length; ++i) {
    const polyResult = pip(pt, polys[i]);
    if (polyResult === 0) return options.ignoreBoundary ? false : true;
    else if (polyResult) result = true;
  }
  return result;
}
function inBBox(pt, bbox) {
  return bbox[0] <= pt[0] && bbox[1] <= pt[1] && bbox[2] >= pt[0] && bbox[3] >= pt[1];
}
var index_default = booleanPointInPolygon;
export {
  booleanPointInPolygon,
  index_default as default
};
//# sourceMappingURL=index.js.map