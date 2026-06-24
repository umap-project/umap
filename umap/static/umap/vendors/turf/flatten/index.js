// index.ts
import { flattenEach } from "@turf/meta";
import { featureCollection } from "@turf/helpers";
function flatten(geojson) {
  if (!geojson) throw new Error("geojson is required");
  var results = [];
  flattenEach(geojson, function(feature) {
    results.push(feature);
  });
  return featureCollection(results);
}
var index_default = flatten;
export {
  index_default as default,
  flatten
};
//# sourceMappingURL=index.js.map