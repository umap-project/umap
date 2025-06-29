var l = Object.defineProperty;
var d = (t, n, e) => n in t ? l(t, n, { enumerable: !0, configurable: !0, writable: !0, value: e }) : t[n] = e;
var p = (t, n, e) => (d(t, typeof n != "symbol" ? n + "" : n, e), e);
const M = [
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon",
  "GeometryCollection"
], f = ["ZM", "Z", "M"], s = "EMPTY";
class G {
  constructor(n) {
    p(this, "value");
    p(this, "position");
    this.value = n.toUpperCase(), this.position = 0;
  }
  match(n) {
    this.skipWhitespaces();
    for (const e of n) {
      const r = e.toUpperCase();
      if (this.value.startsWith(r, this.position))
        return this.position += r.length, e;
    }
    return null;
  }
  matchRegex(n) {
    this.skipWhitespaces();
    for (const e of n) {
      const r = this.value.substring(this.position).match(e);
      if (r)
        return this.position += r[0].length, r;
    }
    return null;
  }
  isMatch(n) {
    return this.skipWhitespaces(), this.value.startsWith(n, this.position) ? (this.position += n.length, !0) : !1;
  }
  matchType() {
    const n = this.match(M);
    if (!n)
      throw new Error("Expected geometry type");
    return n;
  }
  matchDimension() {
    switch (this.match(f)) {
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
  matchCoordinate(n) {
    let e;
    if (n.hasZ && n.hasM ? e = this.matchRegex([/^(\S*)\s+(\S*)\s+(\S*)\s+([^\s,)]*)/i]) : n.hasZ || n.hasM ? e = this.matchRegex([/^(\S*)\s+(\S*)\s+([^\s,)]*)/i]) : e = this.matchRegex([/^(\S*)\s+([^\s,)]*)/i]), !e)
      throw new Error("Expected coordinates");
    const r = n.hasZ && n.hasM ? [
      parseFloat(e[1]),
      parseFloat(e[2]),
      parseFloat(e[3]),
      parseFloat(e[4])
    ] : n.hasZ ? [parseFloat(e[1]), parseFloat(e[2]), parseFloat(e[3])] : n.hasM ? [
      parseFloat(e[1]),
      parseFloat(e[2])
    ] : [parseFloat(e[1]), parseFloat(e[2])];
    if (n.srid && n.srid !== 4326) {
      if (n.proj)
        return n.proj(`EPSG:${n.srid}`, "EPSG:4326", r);
      throw new Error(
        `EWKT data in an unknown SRID (${n.srid}) was provided, but a proj function was not`
      );
    }
    return r;
  }
  matchCoordinates(n) {
    const e = [];
    do {
      const r = this.isMatch("(");
      e.push(this.matchCoordinate(n)), r && this.expectGroupEnd();
    } while (this.isMatch(","));
    return e;
  }
  skipWhitespaces() {
    for (; this.position < this.value.length && this.value[this.position] === " "; )
      this.position++;
  }
}
const g = (t, n) => {
  if (t.isMatch(s))
    return n.emptyAsNull ? null : { type: "Point", coordinates: [] };
  t.expectGroupStart();
  const e = t.matchCoordinate(n);
  return t.expectGroupEnd(), {
    type: "Point",
    coordinates: e
  };
}, E = (t, n) => {
  if (t.isMatch(s))
    return n.emptyAsNull ? null : { type: "LineString", coordinates: [] };
  t.expectGroupStart();
  const e = t.matchCoordinates(n);
  return t.expectGroupEnd(), {
    type: "LineString",
    coordinates: e
  };
}, m = (t, n) => {
  if (t.isMatch(s))
    return n.emptyAsNull ? null : { type: "Polygon", coordinates: [] };
  const e = [];
  for (t.expectGroupStart(), t.expectGroupStart(), e.push(t.matchCoordinates(n)), t.expectGroupEnd(); t.isMatch(","); )
    t.expectGroupStart(), e.push(t.matchCoordinates(n)), t.expectGroupEnd();
  return t.expectGroupEnd(), {
    type: "Polygon",
    coordinates: e
  };
}, S = (t, n) => {
  if (t.isMatch(s))
    return n.emptyAsNull ? null : { type: "MultiPoint", coordinates: [] };
  t.expectGroupStart();
  const e = t.matchCoordinates(n);
  return t.expectGroupEnd(), {
    type: "MultiPoint",
    coordinates: e
  };
}, y = (t, n) => {
  if (t.isMatch(s))
    return n.emptyAsNull ? null : { type: "MultiLineString", coordinates: [] };
  t.expectGroupStart();
  const e = [];
  do
    t.expectGroupStart(), e.push(t.matchCoordinates(n)), t.expectGroupEnd();
  while (t.isMatch(","));
  return t.expectGroupEnd(), {
    type: "MultiLineString",
    coordinates: e
  };
}, x = (t, n) => {
  if (t.isMatch(s))
    return n.emptyAsNull ? null : { type: "MultiPolygon", coordinates: [] };
  t.expectGroupStart();
  const e = [];
  do {
    t.expectGroupStart();
    const r = [], o = [];
    for (t.expectGroupStart(), r.push.apply(r, t.matchCoordinates(n)), t.expectGroupEnd(); t.isMatch(","); )
      t.expectGroupStart(), o.push(t.matchCoordinates(n)), t.expectGroupEnd();
    e.push([r, ...o]), t.expectGroupEnd();
  } while (t.isMatch(","));
  return t.expectGroupEnd(), {
    type: "MultiPolygon",
    coordinates: e
  };
}, P = (t, n) => {
  if (t.isMatch(s))
    return n.emptyAsNull ? null : { type: "GeometryCollection", geometries: [] };
  t.expectGroupStart();
  const e = [];
  do {
    const r = u(t, n);
    r && e.push(r);
  } while (t.isMatch(","));
  return t.expectGroupEnd(), {
    type: "GeometryCollection",
    geometries: e
  };
};
function c(t) {
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
function T(t) {
  return t.coordinates.length === 0 ? "POINT EMPTY" : `POINT${a(t.coordinates)}(${c(
    t.coordinates
  )})`;
}
function L(t) {
  return t.coordinates.length === 0 ? "MULTIPOINT EMPTY" : `MULTIPOINT${a(
    t.coordinates[0]
  )}(${t.coordinates.map((n) => c(n)).join(",")})`;
}
function N(t) {
  if (t.coordinates.length === 0)
    return "LINESTRING EMPTY";
  const n = `(${t.coordinates.map((e) => c(e)).join(",")})`;
  return `LINESTRING${a(t.coordinates[0])}${n}`;
}
function C(t) {
  return t.geometries.length === 0 ? "GEOMETRYCOLLECTION EMPTY" : `GEOMETRYCOLLECTION${`(${t.geometries.map((e) => O(e)).join(",")})`}`;
}
function I(t) {
  if (t.coordinates.length === 0)
    return "MULTILINESTRING EMPTY";
  const n = `(${t.coordinates.map((e) => `(${e.map((r) => c(r))})`)})`;
  return `MULTILINESTRING${a(t.coordinates[0][0])}${n}`;
}
function W(t) {
  var e;
  if (t.coordinates.length === 0)
    return "POLYGON EMPTY";
  const n = `(${t.coordinates.map((r) => `(${r.map((o) => c(o))})`)})`;
  return `POLYGON${a((e = t.coordinates[0]) == null ? void 0 : e[0])}${n}`;
}
function $(t) {
  var e, r;
  if (t.coordinates.length === 0)
    return "MULTIPOLYGON EMPTY";
  const n = `(${t.coordinates.map((o) => `(${o.map((h) => `(${h.map((i) => c(i))})`)})`)})`;
  return `MULTIPOLYGON${a(
    (r = (e = t.coordinates[0]) == null ? void 0 : e[0]) == null ? void 0 : r[0]
  )}${n}`;
}
function u(t, n) {
  let e = null;
  const r = t.matchRegex([/^SRID=(\d+);/i]);
  r && (e = parseInt(r[1], 10));
  const o = t.matchType(), h = t.matchDimension(), i = {
    ...n,
    srid: e,
    hasZ: h.hasZ,
    hasM: h.hasM
  };
  switch (o) {
    case "Point":
      return g(t, i);
    case "LineString":
      return E(t, i);
    case "Polygon":
      return m(t, i);
    case "MultiPoint":
      return S(t, i);
    case "MultiLineString":
      return y(t, i);
    case "MultiPolygon":
      return x(t, i);
    case "GeometryCollection":
      return P(t, i);
  }
}
function O(t) {
  switch (t.type) {
    case "Point":
      return T(t);
    case "LineString":
      return N(t);
    case "MultiPoint":
      return L(t);
    case "GeometryCollection":
      return C(t);
    case "Polygon":
      return W(t);
    case "MultiPolygon":
      return $(t);
    case "MultiLineString":
      return I(t);
  }
}
function Z(t, n = {
  emptyAsNull: !0
}) {
  return u(new G(t), n);
}
export {
  O as geoJSONToWkt,
  Z as wktToGeoJSON
};
