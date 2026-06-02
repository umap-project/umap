// index.ts
import { feature } from "@turf/helpers";
import { getCoords, getType } from "@turf/invariant";
import { booleanPointOnLine } from "@turf/boolean-point-on-line";
import { lineString } from "@turf/helpers";
function cleanCoords(geojson, options = {}) {
  var mutate = typeof options === "object" ? options.mutate : options;
  if (!geojson) throw new Error("geojson is required");
  var type = getType(geojson);
  var newCoords = [];
  switch (type) {
    case "LineString":
      newCoords = cleanLine(geojson, type);
      break;
    case "MultiLineString":
    case "Polygon":
      getCoords(geojson).forEach(function(line) {
        newCoords.push(cleanLine(line, type));
      });
      break;
    case "MultiPolygon":
      getCoords(geojson).forEach(function(polygons) {
        var polyPoints = [];
        polygons.forEach(function(ring) {
          polyPoints.push(cleanLine(ring, type));
        });
        newCoords.push(polyPoints);
      });
      break;
    case "Point":
      return geojson;
    case "MultiPoint":
      var existing = {};
      getCoords(geojson).forEach(function(coord) {
        var key = coord.join("-");
        if (!Object.prototype.hasOwnProperty.call(existing, key)) {
          newCoords.push(coord);
          existing[key] = true;
        }
      });
      break;
    default:
      throw new Error(type + " geometry not supported");
  }
  if (geojson.coordinates) {
    if (mutate === true) {
      geojson.coordinates = newCoords;
      return geojson;
    }
    return { type, coordinates: newCoords };
  } else {
    if (mutate === true) {
      geojson.geometry.coordinates = newCoords;
      return geojson;
    }
    return feature({ type, coordinates: newCoords }, geojson.properties, {
      bbox: geojson.bbox,
      id: geojson.id
    });
  }
}
function cleanLine(line, type) {
  const points = getCoords(line);
  if (points.length === 2 && !equals(points[0], points[1])) return points;
  const newPoints = [];
  let a = 0, b = 1, c = 2;
  newPoints.push(points[a]);
  while (c < points.length) {
    if (booleanPointOnLine(points[b], lineString([points[a], points[c]]))) {
      b = c;
    } else {
      newPoints.push(points[b]);
      a = b;
      b++;
      c = b;
    }
    c++;
  }
  newPoints.push(points[b]);
  if (type === "Polygon" || type === "MultiPolygon") {
    if (booleanPointOnLine(
      newPoints[0],
      lineString([newPoints[1], newPoints[newPoints.length - 2]])
    )) {
      newPoints.shift();
      newPoints.pop();
      newPoints.push(newPoints[0]);
    }
    if (newPoints.length < 4) {
      throw new Error("invalid polygon, fewer than 4 points");
    }
    if (!equals(newPoints[0], newPoints[newPoints.length - 1])) {
      throw new Error("invalid polygon, first and last points not equal");
    }
  }
  return newPoints;
}
function equals(pt1, pt2) {
  return pt1[0] === pt2[0] && pt1[1] === pt2[1];
}
var index_default = cleanCoords;
export {
  cleanCoords,
  index_default as default
};
//# sourceMappingURL=index.js.map