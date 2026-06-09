// index.ts
import { isNumber } from "@turf/helpers";
function getCoord(coord) {
  if (!coord) {
    throw new Error("coord is required");
  }
  if (!Array.isArray(coord)) {
    if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
      return [...coord.geometry.coordinates];
    }
    if (coord.type === "Point") {
      return [...coord.coordinates];
    }
  }
  if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
    return [...coord];
  }
  throw new Error("coord must be GeoJSON Point or an Array of numbers");
}
function getCoords(coords) {
  if (Array.isArray(coords)) {
    return coords;
  }
  if (coords.type === "Feature") {
    if (coords.geometry !== null) {
      return coords.geometry.coordinates;
    }
  } else {
    if (coords.coordinates) {
      return coords.coordinates;
    }
  }
  throw new Error(
    "coords must be GeoJSON Feature, Geometry Object or an Array"
  );
}
function containsNumber(coordinates) {
  if (coordinates.length > 1 && isNumber(coordinates[0]) && isNumber(coordinates[1])) {
    return true;
  }
  if (Array.isArray(coordinates[0]) && coordinates[0].length) {
    return containsNumber(coordinates[0]);
  }
  throw new Error("coordinates must only contain numbers");
}
function geojsonType(value, type, name) {
  if (!type || !name) {
    throw new Error("type and name required");
  }
  if (!value || value.type !== type) {
    throw new Error(
      "Invalid input to " + name + ": must be a " + type + ", given " + value.type
    );
  }
}
function featureOf(feature, type, name) {
  if (!feature) {
    throw new Error("No feature passed");
  }
  if (!name) {
    throw new Error(".featureOf() requires a name");
  }
  if (!feature || feature.type !== "Feature" || !feature.geometry) {
    throw new Error(
      "Invalid input to " + name + ", Feature with geometry required"
    );
  }
  if (!feature.geometry || feature.geometry.type !== type) {
    throw new Error(
      "Invalid input to " + name + ": must be a " + type + ", given " + feature.geometry.type
    );
  }
}
function collectionOf(featureCollection, type, name) {
  if (!featureCollection) {
    throw new Error("No featureCollection passed");
  }
  if (!name) {
    throw new Error(".collectionOf() requires a name");
  }
  if (!featureCollection || featureCollection.type !== "FeatureCollection") {
    throw new Error(
      "Invalid input to " + name + ", FeatureCollection required"
    );
  }
  for (const feature of featureCollection.features) {
    if (!feature || feature.type !== "Feature" || !feature.geometry) {
      throw new Error(
        "Invalid input to " + name + ", Feature with geometry required"
      );
    }
    if (!feature.geometry || feature.geometry.type !== type) {
      throw new Error(
        "Invalid input to " + name + ": must be a " + type + ", given " + feature.geometry.type
      );
    }
  }
}
function getGeom(geojson) {
  if (geojson.type === "Feature") {
    return geojson.geometry;
  }
  return geojson;
}
function getType(geojson, _name) {
  if (geojson.type === "FeatureCollection") {
    return "FeatureCollection";
  }
  if (geojson.type === "GeometryCollection") {
    return "GeometryCollection";
  }
  if (geojson.type === "Feature" && geojson.geometry !== null) {
    return geojson.geometry.type;
  }
  return geojson.type;
}
export {
  collectionOf,
  containsNumber,
  featureOf,
  geojsonType,
  getCoord,
  getCoords,
  getGeom,
  getType
};
//# sourceMappingURL=index.js.map