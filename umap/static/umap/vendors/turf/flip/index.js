// index.ts
import { coordEach } from "@turf/meta";
import { isObject } from "@turf/helpers";
import { clone } from "@turf/clone";
function flip(geojson, options) {
  var _a;
  options = options || {};
  if (!isObject(options)) throw new Error("options is invalid");
  const mutate = (_a = options.mutate) != null ? _a : false;
  if (!geojson) throw new Error("geojson is required");
  if (mutate === false || mutate === void 0) geojson = clone(geojson);
  coordEach(geojson, function(coord) {
    var x = coord[0];
    var y = coord[1];
    coord[0] = y;
    coord[1] = x;
  });
  return geojson;
}
var index_default = flip;
export {
  index_default as default,
  flip
};
//# sourceMappingURL=index.js.map