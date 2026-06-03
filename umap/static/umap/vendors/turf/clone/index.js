// index.ts
function clone(geojson) {
  if (!geojson) {
    throw new Error("geojson is required");
  }
  switch (geojson.type) {
    case "Feature":
      return cloneFeature(geojson);
    case "FeatureCollection":
      return cloneFeatureCollection(geojson);
    case "Point":
    case "LineString":
    case "Polygon":
    case "MultiPoint":
    case "MultiLineString":
    case "MultiPolygon":
    case "GeometryCollection":
      return cloneGeometry(geojson);
    default:
      throw new Error("unknown GeoJSON type");
  }
}
function cloneFeature(geojson) {
  const cloned = { type: "Feature" };
  Object.keys(geojson).forEach((key) => {
    switch (key) {
      case "type":
      case "properties":
      case "geometry":
        return;
      default:
        cloned[key] = geojson[key];
    }
  });
  cloned.properties = cloneProperties(geojson.properties);
  if (geojson.geometry == null) {
    cloned.geometry = null;
  } else {
    cloned.geometry = cloneGeometry(geojson.geometry);
  }
  return cloned;
}
function cloneProperties(properties) {
  const cloned = {};
  if (!properties) {
    return cloned;
  }
  Object.keys(properties).forEach((key) => {
    const value = properties[key];
    if (typeof value === "object") {
      if (value === null) {
        cloned[key] = null;
      } else if (Array.isArray(value)) {
        cloned[key] = value.map((item) => {
          return item;
        });
      } else {
        cloned[key] = cloneProperties(value);
      }
    } else {
      cloned[key] = value;
    }
  });
  return cloned;
}
function cloneFeatureCollection(geojson) {
  const cloned = { type: "FeatureCollection" };
  Object.keys(geojson).forEach((key) => {
    switch (key) {
      case "type":
      case "features":
        return;
      default:
        cloned[key] = geojson[key];
    }
  });
  cloned.features = geojson.features.map((feature) => {
    return cloneFeature(feature);
  });
  return cloned;
}
function cloneGeometry(geometry) {
  const geom = { type: geometry.type };
  if (geometry.bbox) {
    geom.bbox = geometry.bbox;
  }
  if (geometry.type === "GeometryCollection") {
    geom.geometries = geometry.geometries.map((g) => {
      return cloneGeometry(g);
    });
    return geom;
  }
  geom.coordinates = deepSlice(geometry.coordinates);
  return geom;
}
function deepSlice(coords) {
  const cloned = coords;
  if (typeof cloned[0] !== "object") {
    return cloned.slice();
  }
  return cloned.map((coord) => {
    return deepSlice(coord);
  });
}
var index_default = clone;
export {
  clone,
  cloneProperties,
  index_default as default
};
//# sourceMappingURL=index.js.map