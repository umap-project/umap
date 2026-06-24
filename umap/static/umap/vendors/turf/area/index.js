// index.ts
import { earthRadius } from "@turf/helpers";
import { geomReduce } from "@turf/meta";
function area(geojson) {
  return geomReduce(
    geojson,
    (value, geom) => {
      return value + calculateArea(geom);
    },
    0
  );
}
function calculateArea(geom) {
  let total = 0;
  let i;
  switch (geom.type) {
    case "Polygon":
      return polygonArea(geom.coordinates);
    case "MultiPolygon":
      for (i = 0; i < geom.coordinates.length; i++) {
        total += polygonArea(geom.coordinates[i]);
      }
      return total;
    case "Point":
    case "MultiPoint":
    case "LineString":
    case "MultiLineString":
      return 0;
  }
  return 0;
}
function polygonArea(coords) {
  let total = 0;
  if (coords && coords.length > 0) {
    total += Math.abs(ringArea(coords[0]));
    for (let i = 1; i < coords.length; i++) {
      total -= Math.abs(ringArea(coords[i]));
    }
  }
  return total;
}
var FACTOR = earthRadius * earthRadius / 2;
var PI_OVER_180 = Math.PI / 180;
function ringArea(coords) {
  const coordsLength = coords.length - 1;
  if (coordsLength <= 2) return 0;
  let total = 0;
  let i = 0;
  while (i < coordsLength) {
    const lower = coords[i];
    const middle = coords[i + 1 === coordsLength ? 0 : i + 1];
    const upper = coords[i + 2 >= coordsLength ? (i + 2) % coordsLength : i + 2];
    const lowerX = lower[0] * PI_OVER_180;
    const middleY = middle[1] * PI_OVER_180;
    const upperX = upper[0] * PI_OVER_180;
    total += (upperX - lowerX) * Math.sin(middleY);
    i++;
  }
  return total * FACTOR;
}
var index_default = area;
export {
  area,
  index_default as default
};
//# sourceMappingURL=index.js.map