// index.ts
import { distance } from "@turf/distance";
import { segmentReduce } from "@turf/meta";
function length(geojson, options = {}) {
  return segmentReduce(
    geojson,
    (previousValue, segment) => {
      const coords = segment.geometry.coordinates;
      return previousValue + distance(coords[0], coords[1], options);
    },
    0
  );
}
var index_default = length;
export {
  index_default as default,
  length
};
//# sourceMappingURL=index.js.map