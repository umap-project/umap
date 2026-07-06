var d = Object.defineProperty;
var M = (t, e, n) => e in t ? d(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var u = (t, e, n) => (M(t, typeof e != "symbol" ? e + "" : e, n), n);
const f = [
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon",
  "GeometryCollection"
], g = ["ZM", "Z", "M"], c = "EMPTY";
class G {
  constructor(e) {
    u(this, "value");
    u(this, "position");
    this.value = e.toUpperCase(), this.position = 0;
  }
  match(e) {
    this.skipWhitespaces();
    for (const n of e) {
      const r = n.toUpperCase();
      if (this.value.startsWith(r, this.position))
        return this.position += r.length, n;
    }
    return null;
  }
  matchRegex(e) {
    this.skipWhitespaces();
    for (const n of e) {
      const r = this.value.substring(this.position).match(n);
      if (r)
        return this.position += r[0].length, r;
    }
    return null;
  }
  isMatch(e) {
    return this.skipWhitespaces(), this.value.startsWith(e, this.position) ? (this.position += e.length, !0) : !1;
  }
  matchType() {
    const e = this.match(f);
    if (!e)
      throw new Error("Expected geometry type");
    return e;
  }
  matchDimension() {
    switch (this.match(g)) {
      case "ZM":
        return { hasZ: !0, hasM: !0 };
      case "Z":
        return { hasZ: !0, hasM: !1 };
      case "M":
        return { hasZ: !1, hasM: !0 };
      default:
        return { hasZ: !1, hasM: !1 };
    }
  }
  expectGroupStart() {
    if (!this.isMatch("("))
      throw new Error("Expected group start");
  }
  expectGroupEnd() {
    if (!this.isMatch(")"))
      throw new Error("Expected group end");
  }
  matchCoordinate(e) {
    let n;
    if (e.hasZ && e.hasM ? n = this.matchRegex([/^(\S*)\s+(\S*)\s+(\S*)\s+([^\s,)]*)/i]) : e.hasZ || e.hasM ? n = this.matchRegex([/^(\S*)\s+(\S*)\s+([^\s,)]*)/i]) : n = this.matchRegex([/^(\S*)\s+([^\s,)]*)/i]), !n)
      throw new Error("Expected coordinates");
    const r = e.hasZ && e.hasM ? [
      parseFloat(n[1]),
      parseFloat(n[2]),
      parseFloat(n[3]),
      parseFloat(n[4])
    ] : e.hasZ ? [parseFloat(n[1]), parseFloat(n[2]), parseFloat(n[3])] : e.hasM ? [
      parseFloat(n[1]),
      parseFloat(n[2])
    ] : [parseFloat(n[1]), parseFloat(n[2])];
    if (!e.srid || e.srid === 4326)
      return r;
    if (e.srid === "http://www.opengis.net/def/crs/epsg/0/4326")
      return r.length === 3 ? [r[1], r[0], r[2]] : [r[1], r[0]];
    if (!e.proj)
      throw new Error(
        `EWKT data in an unknown SRID (${e.srid}) was provided, but a proj function was not`
      );
    return e.proj(
      typeof e.srid == "string" ? e.srid : `EPSG:${e.srid}`,
      "EPSG:4326",
      r
    );
  }
  matchCoordinates(e) {
    const n = [];
    do {
      const r = this.isMatch("(");
      n.push(this.matchCoordinate(e)), r && this.expectGroupEnd();
    } while (this.isMatch(","));
    return n;
  }
  skipWhitespaces() {
    for (; this.position < this.value.length && this.value[this.position] === " "; )
      this.position++;
  }
}
const E = (t, e) => {
  if (t.isMatch(c))
    return e.emptyAsNull ? null : { type: "Point", coordinates: [] };
  t.expectGroupStart();
  const n = t.matchCoordinate(e);
  return t.expectGroupEnd(), {
    type: "Point",
    coordinates: n
  };
}, m = (t, e) => {
  if (t.isMatch(c))
    return e.emptyAsNull ? null : { type: "LineString", coordinates: [] };
  t.expectGroupStart();
  const n = t.matchCoordinates(e);
  return t.expectGroupEnd(), {
    type: "LineString",
    coordinates: n
  };
}, y = (t, e) => {
  if (t.isMatch(c))
    return e.emptyAsNull ? null : { type: "Polygon", coordinates: [] };
  const n = [];
  for (t.expectGroupStart(), t.expectGroupStart(), n.push(t.matchCoordinates(e)), t.expectGroupEnd(); t.isMatch(","); )
    t.expectGroupStart(), n.push(t.matchCoordinates(e)), t.expectGroupEnd();
  return t.expectGroupEnd(), {
    type: "Polygon",
    coordinates: n
  };
}, S = (t, e) => {
  if (t.isMatch(c))
    return e.emptyAsNull ? null : { type: "MultiPoint", coordinates: [] };
  t.expectGroupStart();
  const n = t.matchCoordinates(e);
  return t.expectGroupEnd(), {
    type: "MultiPoint",
    coordinates: n
  };
}, x = (t, e) => {
  if (t.isMatch(c))
    return e.emptyAsNull ? null : { type: "MultiLineString", coordinates: [] };
  t.expectGroupStart();
  const n = [];
  do
    t.expectGroupStart(), n.push(t.matchCoordinates(e)), t.expectGroupEnd();
  while (t.isMatch(","));
  return t.expectGroupEnd(), {
    type: "MultiLineString",
    coordinates: n
  };
}, P = (t, e) => {
  if (t.isMatch(c))
    return e.emptyAsNull ? null : { type: "MultiPolygon", coordinates: [] };
  t.expectGroupStart();
  const n = [];
  do {
    t.expectGroupStart();
    const r = [], s = [];
    for (t.expectGroupStart(), r.push.apply(r, t.matchCoordinates(e)), t.expectGroupEnd(); t.isMatch(","); )
      t.expectGroupStart(), s.push(t.matchCoordinates(e)), t.expectGroupEnd();
    n.push([r, ...s]), t.expectGroupEnd();
  } while (t.isMatch(","));
  return t.expectGroupEnd(), {
    type: "MultiPolygon",
    coordinates: n
  };
}, T = (t, e) => {
  if (t.isMatch(c))
    return e.emptyAsNull ? null : { type: "GeometryCollection", geometries: [] };
  t.expectGroupStart();
  const n = [];
  do {
    const r = l(t, e);
    r && n.push(r);
  } while (t.isMatch(","));
  return t.expectGroupEnd(), {
    type: "GeometryCollection",
    geometries: n
  };
};
function o(t) {
  return t.join(" ");
}
function a(t) {
  if (t === void 0)
    return " ";
  switch (t.length) {
    case 3:
      return " Z ";
    default:
      return " ";
  }
}
function L(t) {
  return t.coordinates.length === 0 ? "POINT EMPTY" : `POINT${a(t.coordinates)}(${o(
    t.coordinates
  )})`;
}
function N(t, e) {
  return t.coordinates.length === 0 ? "MULTIPOINT EMPTY" : `MULTIPOINT${a(
    t.coordinates[0]
  )}(${t.coordinates.map(
    (n) => e.version === "1.2.0" ? `(${o(n)})` : o(n)
  ).join(",")})`;
}
function C(t) {
  if (t.coordinates.length === 0)
    return "LINESTRING EMPTY";
  const e = `(${t.coordinates.map((n) => o(n)).join(",")})`;
  return `LINESTRING${a(t.coordinates[0])}${e}`;
}
function $(t, e) {
  return t.geometries.length === 0 ? "GEOMETRYCOLLECTION EMPTY" : `GEOMETRYCOLLECTION${`(${t.geometries.map((r) => w(r, e)).join(",")})`}`;
}
function I(t) {
  if (t.coordinates.length === 0)
    return "MULTILINESTRING EMPTY";
  const e = `(${t.coordinates.map((n) => `(${n.map((r) => o(r))})`)})`;
  return `MULTILINESTRING${a(t.coordinates[0][0])}${e}`;
}
function W(t) {
  var n;
  if (t.coordinates.length === 0)
    return "POLYGON EMPTY";
  const e = `(${t.coordinates.map((r) => `(${r.map((s) => o(s))})`)})`;
  return `POLYGON${a((n = t.coordinates[0]) == null ? void 0 : n[0])}${e}`;
}
function O(t) {
  var n, r;
  if (t.coordinates.length === 0)
    return "MULTIPOLYGON EMPTY";
  const e = `(${t.coordinates.map((s) => `(${s.map((h) => `(${h.map((i) => o(i))})`)})`)})`;
  return `MULTIPOLYGON${a(
    (r = (n = t.coordinates[0]) == null ? void 0 : n[0]) == null ? void 0 : r[0]
  )}${e}`;
}
function l(t, e) {
  let n = null;
  const r = t.matchRegex([/^SRID=(\d+);/i]);
  if (r)
    n = parseInt(r[1], 10);
  else {
    const p = t.matchRegex([/^<([^>]+)>/i]);
    p && (n = p[1].toLowerCase());
  }
  const s = t.matchType(), h = t.matchDimension(), i = {
    ...e,
    srid: n,
    hasZ: h.hasZ,
    hasM: h.hasM
  };
  switch (s) {
    case "Point":
      return E(t, i);
    case "LineString":
      return m(t, i);
    case "Polygon":
      return y(t, i);
    case "MultiPoint":
      return S(t, i);
    case "MultiLineString":
      return x(t, i);
    case "MultiPolygon":
      return P(t, i);
    case "GeometryCollection":
      return T(t, i);
  }
}
function w(t, e = { version: "1.1.0" }) {
  switch (t.type) {
    case "Point":
      return L(t);
    case "LineString":
      return C(t);
    case "MultiPoint":
      return N(t, e);
    case "GeometryCollection":
      return $(t, e);
    case "Polygon":
      return W(t);
    case "MultiPolygon":
      return O(t);
    case "MultiLineString":
      return I(t);
  }
}
function R(t, e = {
  emptyAsNull: !0
}) {
  return l(new G(t), e);
}
export {
  w as geoJSONToWkt,
  R as wktToGeoJSON
};
