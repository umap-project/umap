// index.ts
import { point } from "@turf/helpers";
import { coordEach } from "@turf/meta";
function centroid(geojson, options = {}) {
  let xSum = 0;
  let ySum = 0;
  let len = 0;
  coordEach(
    geojson,
    function(coord) {
      xSum += coord[0];
      ySum += coord[1];
      len++;
    },
    true
  );
  return point([xSum / len, ySum / len], options.properties);
}
var index_default = centroid;
export {
  centroid,
  index_default as default
};
//# sourceMappingURL=index.js.map