// index.ts
import * as polyclip from "polyclip-ts";
import { multiPolygon, polygon } from "@turf/helpers";
import { geomEach } from "@turf/meta";
function union2(features, options = {}) {
  const geoms = [];
  geomEach(features, (geom) => {
    geoms.push(geom.coordinates);
  });
  if (geoms.length < 2) {
    throw new Error("Must have at least 2 geometries");
  }
  const unioned = polyclip.union(geoms[0], ...geoms.slice(1));
  if (unioned.length === 0) return null;
  if (unioned.length === 1) return polygon(unioned[0], options.properties);
  else return multiPolygon(unioned, options.properties);
}
var index_default = union2;
export {
  index_default as default,
  union2 as union
};
//# sourceMappingURL=index.js.map