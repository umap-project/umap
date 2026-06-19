// index.ts
import { convertLength, earthRadius } from "@turf/helpers";
import { getCoord } from "@turf/invariant";
function rhumbDistance(from, to, options = {}) {
  const origin = getCoord(from);
  const destination = getCoord(to);
  destination[0] += destination[0] - origin[0] > 180 ? -360 : origin[0] - destination[0] > 180 ? 360 : 0;
  const distanceInMeters = calculateRhumbDistance(origin, destination);
  const distance = convertLength(distanceInMeters, "meters", options.units);
  return distance;
}
function calculateRhumbDistance(origin, destination, radius) {
  radius = radius === void 0 ? earthRadius : Number(radius);
  const R = radius;
  const phi1 = origin[1] * Math.PI / 180;
  const phi2 = destination[1] * Math.PI / 180;
  const DeltaPhi = phi2 - phi1;
  let DeltaLambda = Math.abs(destination[0] - origin[0]) * Math.PI / 180;
  if (DeltaLambda > Math.PI) {
    DeltaLambda -= 2 * Math.PI;
  }
  const DeltaPsi = Math.log(
    Math.tan(phi2 / 2 + Math.PI / 4) / Math.tan(phi1 / 2 + Math.PI / 4)
  );
  const q = Math.abs(DeltaPsi) > 1e-11 ? DeltaPhi / DeltaPsi : Math.cos(phi1);
  const delta = Math.sqrt(
    DeltaPhi * DeltaPhi + q * q * DeltaLambda * DeltaLambda
  );
  const dist = delta * R;
  return dist;
}
var index_default = rhumbDistance;
export {
  index_default as default,
  rhumbDistance
};
//# sourceMappingURL=index.js.map