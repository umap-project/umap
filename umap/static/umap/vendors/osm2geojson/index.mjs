//#region \0rolldown/runtime.js
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
//#endregion
//#region src/utils.ts
function purgeProps(obj, blacklist) {
	if (obj) {
		const rs = Object.assign({}, obj);
		if (blacklist) for (const prop of blacklist) delete rs[prop];
		return rs;
	}
	return {};
}
function first(a) {
	return a[0];
}
function last(a) {
	return a[a.length - 1];
}
function coordsToKey(a) {
	return a.join(",");
}
function addToMap(m, k, v) {
	const a = m[k];
	if (a) a.push(v);
	else m[k] = [v];
}
function removeFromMap(m, k, v) {
	const a = m[k];
	let idx = -1;
	if (a) idx = a.indexOf(v);
	if (idx >= 0) a.splice(idx, 1);
}
function getFirstFromMap(m, k) {
	const a = m[k];
	if (a && a.length > 0) return a[0];
	return null;
}
function isRing(a) {
	return a.length > 3 && coordsToKey(first(a)) === coordsToKey(last(a));
}
function ringDirection(a, xIdx, yIdx) {
	xIdx = xIdx || 0, yIdx = yIdx || 1;
	const m = a.reduce((maxxIdx, v, idx) => a[maxxIdx][xIdx || 0] > v[xIdx || 0] ? maxxIdx : idx, 0);
	const l = m <= 0 ? a.length - 2 : m - 1;
	const r = m >= a.length - 1 ? 1 : m + 1;
	const xa = a[l][xIdx];
	const xb = a[m][xIdx];
	const xc = a[r][xIdx];
	const ya = a[l][yIdx];
	const yb = a[m][yIdx];
	const yc = a[r][yIdx];
	return (xb - xa) * (yc - ya) - (xc - xa) * (yb - ya) < 0 ? "clockwise" : "counterclockwise";
}
function pointInsidePolygon(pt, polygon, xIdx, yIdx) {
	xIdx = xIdx || 0, yIdx = yIdx || 1;
	let result = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) if ((polygon[i][xIdx] <= pt[xIdx] && pt[xIdx] < polygon[j][xIdx] || polygon[j][xIdx] <= pt[xIdx] && pt[xIdx] < polygon[i][xIdx]) && pt[yIdx] < (polygon[j][yIdx] - polygon[i][yIdx]) * (pt[xIdx] - polygon[i][xIdx]) / (polygon[j][xIdx] - polygon[i][xIdx]) + polygon[i][yIdx]) result = !result;
	return result;
}
function strArrayArrayToFloat(el) {
	return el.map(strArrayToFloat);
}
function strArrayToFloat(el) {
	return el.map(parseFloat);
}
var init_utils = __esmMin((() => {}));
//#endregion
//#region src/xmlparser.ts
function conditioned(evt) {
	return evt.match(/^(.+?)\[(.+?)\]>$/g) !== null;
}
function parseEvent(evt) {
	const match = /^(.+?)\[(.+?)\]>$/g.exec(evt);
	if (match) return {
		evt: match[1] + ">",
		exp: match[2]
	};
	return { evt };
}
function genConditionFunc(cond) {
	const body = "return " + cond.replace(/(\$.+?)(?=[=!.])/g, "node.$&") + ";";
	return new Function("node", body);
}
var XmlParser;
var init_xmlparser = __esmMin((() => {
	XmlParser = class {
		constructor(opts) {
			this.queryParent = false;
			this.progressive = false;
			this.parentMap = /* @__PURE__ */ new WeakMap();
			if (opts) {
				this.queryParent = opts.queryParent ? true : false;
				this.progressive = opts.progressive;
				if (this.queryParent) this.parentMap = /* @__PURE__ */ new WeakMap();
			}
			this.evtListeners = {};
		}
		parse(xml, parent, dir) {
			dir = dir ? dir + "." : "";
			const nodeRegEx = /<([^ >\/]+)(.*?)>/gm;
			const nodes = [];
			let nodeMatch = nodeRegEx.exec(xml);
			while (nodeMatch) {
				const tag = nodeMatch[1];
				const node = { $tag: tag };
				const fullTag = dir + tag;
				const attrText = nodeMatch[2].trim();
				let closed = false;
				if (attrText.endsWith("/") || tag.startsWith("?") || tag.startsWith("!")) closed = true;
				const attRegEx1 = /([^ ]+?)="(.+?)"/g;
				const attRegEx2 = /([^ ]+?)='(.+?)'/g;
				let attMatch = attRegEx1.exec(attrText);
				let hasAttrs = false;
				while (attMatch) {
					hasAttrs = true;
					node[attMatch[1]] = attMatch[2];
					attMatch = attRegEx1.exec(attrText);
				}
				if (!hasAttrs) {
					attMatch = attRegEx2.exec(attrText);
					while (attMatch) {
						hasAttrs = true;
						node[attMatch[1]] = attMatch[2];
						attMatch = attRegEx2.exec(attrText);
					}
				}
				if (!hasAttrs && attrText !== "") node.text = attrText;
				if (this.progressive) this.emit(`<${fullTag}>`, node, parent);
				if (!closed) {
					const innerRegEx = new RegExp(`([^]+?)<\/${tag}>`, "g");
					innerRegEx.lastIndex = nodeRegEx.lastIndex;
					const innerMatch = innerRegEx.exec(xml);
					if (innerMatch && innerMatch[1]) {
						nodeRegEx.lastIndex = innerRegEx.lastIndex;
						const innerNodes = this.parse(innerMatch[1], node, fullTag);
						if (innerNodes.length > 0) node.$innerNodes = innerNodes;
						else node.$innerText = innerMatch[1];
					}
				}
				if (this.queryParent && parent) this.parentMap.set(node, parent);
				if (this.progressive) this.emit(`</${fullTag}>`, node, parent);
				nodes.push(node);
				nodeMatch = nodeRegEx.exec(xml);
			}
			return nodes;
		}
		getParent(node) {
			if (this.queryParent) return this.parentMap.get(node);
			return null;
		}
		addListener(evt, func) {
			if (conditioned(evt)) {
				const ev = parseEvent(evt);
				if (ev.exp) func.condition = genConditionFunc(ev.exp);
				evt = ev.evt;
			}
			this.$addListener(evt, func);
		}
		removeListener(evt, func) {
			if (conditioned(evt)) evt = parseEvent(evt).evt;
			this.$removeListener(evt, func);
		}
		on(evt, func) {
			this.addListener(evt, func);
		}
		off(evt, func) {
			this.removeListener(evt, func);
		}
		$addListener(evt, func) {
			const funcs = this.evtListeners[evt];
			if (funcs) funcs.push(func);
			else this.evtListeners[evt] = [func];
		}
		$removeListener(evt, func) {
			const funcs = this.evtListeners[evt];
			let idx = -1;
			if (funcs) idx = funcs.indexOf(func);
			if (idx >= 0) funcs.splice(idx, 1);
		}
		emit(evt, ...args) {
			const funcs = this.evtListeners[evt];
			if (funcs) for (const func of funcs) if (func.condition) {
				if (func.condition.apply(null, args) === true) func.apply(null, args);
			} else func.apply(null, args);
		}
	};
}));
//#endregion
//#region src/osm-object.ts
var OsmObject;
var init_osm_object = __esmMin((() => {
	OsmObject = class {
		constructor(type, id, refElems) {
			this.type = type;
			this.id = id;
			this.refElems = refElems;
			this.tags = {};
			this.props = { id: this.getCompositeId() };
			this.refCount = 0;
			this.hasTag = false;
			if (refElems) refElems.add(this.getCompositeId(), this);
		}
		addTags(tags) {
			this.tags = Object.assign(this.tags, tags);
			this.hasTag = true;
		}
		addTag(k, v) {
			this.tags[k] = v;
			this.hasTag = true;
		}
		addProp(k, v) {
			this.props[k] = v;
		}
		addProps(props) {
			this.props = Object.assign(this.props, props);
		}
		getCompositeId() {
			return `${this.type}/${this.id}`;
		}
		getProps() {
			return Object.assign(this.props, this.tags);
		}
	};
}));
//#endregion
//#region src/node.ts
var Node;
var init_node = __esmMin((() => {
	init_osm_object();
	init_utils();
	Node = class extends OsmObject {
		constructor(id, refElems) {
			super("node", id, refElems);
		}
		setLatLng(latLng) {
			this.latLng = latLng;
		}
		toFeatureArray() {
			if (this.latLng) return [{
				type: "Feature",
				id: this.getCompositeId(),
				properties: this.getProps(),
				geometry: {
					type: "Point",
					coordinates: strArrayToFloat([this.latLng.lon, this.latLng.lat])
				}
			}];
			return [];
		}
		getLatLng() {
			return this.latLng;
		}
	};
}));
//#endregion
//#region src/late-binder.ts
var LateBinder;
var init_late_binder = __esmMin((() => {
	LateBinder = class {
		constructor(container, valueFunc, ctx, args) {
			this.container = container;
			this.valueFunc = valueFunc;
			this.ctx = ctx;
			this.args = args;
		}
		bind() {
			const v = this.valueFunc.apply(this.ctx, this.args);
			const idx = this.container.indexOf(this);
			if (idx < 0) return;
			const args = [idx, 1];
			if (v) args.push(v);
			Array.prototype.splice.apply(this.container, args);
		}
	};
}));
//#endregion
//#region src/polytags.json
init_xmlparser();
init_node();
init_late_binder();
var polytags_default = {
	building: {},
	highway: { "whitelist": [
		"services",
		"rest_area",
		"escape",
		"elevator"
	] },
	natural: { "blacklist": [
		"coastline",
		"cliff",
		"ridge",
		"arete",
		"tree_row"
	] },
	landuse: {},
	waterway: { "whitelist": [
		"riverbank",
		"dock",
		"boatyard",
		"dam"
	] },
	amenity: {},
	leisure: {},
	barrier: { "whitelist": [
		"city_wall",
		"ditch",
		"hedge",
		"retaining_wall",
		"wall",
		"spikes"
	] },
	railway: { "whitelist": [
		"station",
		"turntable",
		"roundhouse",
		"platform"
	] },
	area: {},
	boundary: {},
	man_made: { "blacklist": [
		"cutline",
		"embankment",
		"pipeline"
	] },
	power: { "whitelist": [
		"plant",
		"substation",
		"generator",
		"transformer"
	] },
	place: {},
	shop: {},
	aeroway: { "blacklist": ["taxiway"] },
	tourism: {},
	historic: {},
	public_transport: {},
	office: {},
	"building:part": {},
	military: {},
	ruins: {},
	"area:highway": {},
	craft: {},
	golf: {},
	indoor: {}
};
//#endregion
//#region src/way.ts
var Way;
var init_way = __esmMin((() => {
	init_osm_object();
	init_utils();
	Way = class extends OsmObject {
		constructor(id, refElems) {
			super("way", id, refElems);
			this.latLngArray = [];
			this.isPolygon = false;
		}
		addLatLng(latLng) {
			this.latLngArray.push(latLng);
		}
		setLatLngArray(latLngArray) {
			this.latLngArray = latLngArray;
		}
		addNodeRef(ref) {
			const binder = new LateBinder(this.latLngArray, (id) => {
				const node = this.refElems.get(`node/${id}`);
				if (node) {
					node.refCount++;
					return node.getLatLng();
				}
			}, this, [ref]);
			this.latLngArray.push(binder);
			this.refElems.addBinder(binder);
		}
		addTags(tags) {
			super.addTags(tags);
			for (const [k, v] of Object.entries(tags)) this.analyzeTag(k, v);
		}
		addTag(k, v) {
			super.addTag(k, v);
			this.analyzeTag(k, v);
		}
		toCoordsArray() {
			return this.latLngArray.map((latLng) => [latLng.lon, latLng.lat]);
		}
		toFeatureArray() {
			let coordsArrayString = this.toCoordsArray();
			if (coordsArrayString.length > 1) {
				const coordsArray = strArrayArrayToFloat(coordsArrayString);
				const feature = {
					type: "Feature",
					id: this.getCompositeId(),
					properties: this.getProps(),
					geometry: {
						type: "LineString",
						coordinates: coordsArray
					}
				};
				if (this.isPolygon && isRing(coordsArray)) {
					if (ringDirection(coordsArray) !== "counterclockwise") coordsArray.reverse();
					feature.geometry = {
						type: "Polygon",
						coordinates: [coordsArray]
					};
					return [feature];
				}
				return [feature];
			}
			return [];
		}
		analyzeTag(k, v) {
			const o = polytags_default[k];
			if (o) {
				this.isPolygon = true;
				if (o.whitelist) this.isPolygon = o.whitelist.indexOf(v) >= 0 ? true : false;
				else if (o.blacklist) this.isPolygon = o.blacklist.indexOf(v) >= 0 ? false : true;
			}
		}
	};
}));
//#endregion
//#region src/way-collection.ts
var WayCollection;
var init_way_collection = __esmMin((() => {
	init_utils();
	WayCollection = class extends Array {
		constructor() {
			super();
			this.firstMap = {};
			this.lastMap = {};
		}
		addWay(way) {
			const w = way.toCoordsArray();
			if (w.length > 0) {
				this.push(w);
				addToMap(this.firstMap, coordsToKey(first(w)), w);
				addToMap(this.lastMap, coordsToKey(last(w)), w);
			}
		}
		mergeWays() {
			const strings = [];
			let way = this.shift();
			while (way) {
				removeFromMap(this.firstMap, coordsToKey(first(way)), way);
				removeFromMap(this.lastMap, coordsToKey(last(way)), way);
				let current = way;
				let next;
				do {
					let nextWay = this.getNextWay(current);
					next = nextWay.next;
					let mergeType = nextWay.mergeType;
					if (!next) continue;
					this.splice(this.indexOf(next), 1);
					removeFromMap(this.firstMap, coordsToKey(first(next)), next);
					removeFromMap(this.lastMap, coordsToKey(last(next)), next);
					switch (mergeType) {
						case 0:
							current = current.concat(next.slice(1));
							break;
						case 1:
							next.reverse();
							current = current.concat(next.slice(1));
							break;
						case 2:
							current.reverse();
							current = current.concat(next.slice(1));
							break;
						case 3:
							current = next.concat(current.slice(1));
							current.reverse();
							break;
					}
				} while (next);
				strings.push(strArrayArrayToFloat(current));
				way = this.shift();
			}
			return strings;
		}
		/**
		* Try to find the next way to add to the current way.
		* It first tries the next way in the array, and if this doesn't work, try any other way.
		*/
		getNextWay(current) {
			const lastKey = coordsToKey(last(current));
			const firstKey = coordsToKey(first(current));
			let next = this.length > 0 ? this[0] : null;
			if (next) {
				const nextFirstKey = coordsToKey(first(next));
				const nextLastKey = coordsToKey(last(next));
				if (lastKey === nextFirstKey) return {
					next,
					mergeType: 0
				};
				if (lastKey === nextLastKey) return {
					next,
					mergeType: 1
				};
				if (firstKey === nextFirstKey) return {
					next,
					mergeType: 2
				};
				if (firstKey === nextLastKey) return {
					next,
					mergeType: 3
				};
			}
			next = getFirstFromMap(this.firstMap, lastKey);
			if (next) return {
				next,
				mergeType: 0
			};
			next = getFirstFromMap(this.lastMap, lastKey);
			return {
				next,
				mergeType: 1
			};
		}
		toRings(direction) {
			const strings = this.mergeWays();
			const rings = [];
			let str = strings.shift();
			while (str) {
				if (isRing(str)) {
					if (ringDirection(str) !== direction) str.reverse();
					rings.push(str);
				}
				str = strings.shift();
			}
			return rings;
		}
	};
}));
//#endregion
//#region src/relation.ts
var Relation;
var init_relation = __esmMin((() => {
	init_osm_object();
	init_way();
	init_way_collection();
	init_late_binder();
	init_utils();
	Relation = class extends OsmObject {
		constructor(id, refElems) {
			super("relation", id, refElems);
			this.relations = [];
			this.nodes = [];
			this.bounds = void 0;
			this.ways = [];
			this.roles = [];
		}
		setBounds(bounds) {
			this.bounds = bounds;
		}
		addMember(member) {
			switch (member.type) {
				case "relation":
					let binder = new LateBinder(this.relations, (id) => {
						const relation = this.refElems.get(`relation/${id}`);
						if (relation) {
							relation.refCount++;
							return relation;
						}
					}, this, [member.ref]);
					this.relations.push(binder);
					this.refElems.addBinder(binder);
					break;
				case "way":
					if (!member.role) member.role = "";
					if (member.geometry) {
						const way = new Way(member.ref, this.refElems);
						way.setLatLngArray(member.geometry);
						way.refCount++;
						this.ways.push(way);
						this.roles.push(member.role);
					} else if (member.nodes) {
						const way = new Way(member.ref, this.refElems);
						for (const nid of member.nodes) way.addNodeRef(nid);
						way.refCount++;
						this.ways.push(way);
						this.roles.push(member.role);
					} else {
						let binder = new LateBinder(this.ways, (nid) => {
							const way = this.refElems.get(`way/${nid}`);
							if (way) {
								way.refCount++;
								return way;
							}
						}, this, [member.ref]);
						this.ways.push(binder);
						this.roles.push(member.role);
						this.refElems.addBinder(binder);
					}
					break;
				case "node":
					let node = null;
					if (member.lat && member.lon) {
						node = new Node(member.ref, this.refElems);
						node.setLatLng({
							lon: member.lon,
							lat: member.lat
						});
						if (member.tags) node.addTags(member.tags);
						for (const [k, v] of Object.entries(member)) if ([
							"id",
							"type",
							"lat",
							"lon"
						].indexOf(k) < 0) node.addProp(k, v);
						node.refCount++;
						this.nodes.push(node);
					} else {
						let binder = new LateBinder(this.nodes, (id) => {
							const nn = this.refElems.get(`node/${id}`);
							if (nn) {
								nn.refCount++;
								return nn;
							}
						}, this, [member.ref]);
						this.nodes.push(binder);
						this.refElems.addBinder(binder);
					}
					break;
			}
		}
		constructStringGeometry(ws) {
			const strings = ws ? ws.mergeWays() : [];
			if (strings.length === 0) return null;
			return {
				type: "MultiLineString",
				coordinates: strings
			};
		}
		constructPolygonGeometry(ows, iws) {
			const outerRings = ows ? ows.toRings("counterclockwise") : [];
			const innerRings = iws ? iws.toRings("clockwise") : [];
			if (outerRings.length > 0) {
				const compositPolyons = [];
				let ring;
				for (ring of outerRings) compositPolyons.push([ring]);
				ring = innerRings.shift();
				while (ring) {
					for (const idx in outerRings) if (pointInsidePolygon(first(ring), outerRings[idx])) {
						compositPolyons[idx].push(ring);
						break;
					}
					ring = innerRings.shift();
				}
				if (compositPolyons.length === 1) return {
					type: "Polygon",
					coordinates: compositPolyons[0]
				};
				return {
					type: "MultiPolygon",
					coordinates: compositPolyons
				};
			}
			return null;
		}
		collectAllWaysForRelation(relation, relationToWaysMap) {
			const ways = [...relation.ways];
			const roles = [...relation.roles];
			if (relation.relations.length === 0) {
				relationToWaysMap.set(relation.id, {
					ways,
					roles
				});
				return {
					ways,
					roles
				};
			}
			for (const subRelation of relation.relations) {
				if (!subRelation) continue;
				if (!relationToWaysMap.has(subRelation.id)) this.collectAllWaysForRelation(subRelation, relationToWaysMap);
				const entry = relationToWaysMap.get(subRelation.id);
				for (let i = 0; i < entry.ways.length; i++) {
					ways.push(entry.ways[i]);
					roles.push(entry.roles[i]);
				}
			}
			relationToWaysMap.set(relation.id, {
				ways,
				roles
			});
			return {
				ways,
				roles
			};
		}
		toFeatureArray() {
			const polygonFeatures = [];
			const stringFeatures = [];
			let pointFeatures = [];
			const relationToWaysMap = /* @__PURE__ */ new Map();
			const waysAndRoles = this.collectAllWaysForRelation(this, relationToWaysMap);
			let templateFeature = {
				type: "Feature",
				id: this.getCompositeId(),
				bbox: this.bounds,
				properties: this.getProps(),
				geometry: null
			};
			if (!this.bounds) delete templateFeature.bbox;
			if (this.roles.some((r) => r === "outer")) {
				const outerWayCollection = new WayCollection();
				const innerWayCollection = new WayCollection();
				for (let i = 0; i < waysAndRoles.ways.length; i++) {
					const way = waysAndRoles.ways[i];
					const role = waysAndRoles.roles[i];
					if (role === "outer") outerWayCollection.addWay(way);
					else if (role === "inner") innerWayCollection.addWay(way);
				}
				let feature = Object.assign({}, templateFeature);
				let geometry = this.constructPolygonGeometry(outerWayCollection, innerWayCollection);
				if (geometry) {
					feature.geometry = geometry;
					polygonFeatures.push(feature);
				}
			} else {
				const wayCollection = new WayCollection();
				for (let way of waysAndRoles.ways) wayCollection.addWay(way);
				let geometry = this.constructStringGeometry(wayCollection);
				if (geometry) {
					let feature = Object.assign({}, templateFeature);
					feature.geometry = geometry;
					stringFeatures.push(feature);
				}
			}
			for (let node of this.nodes) pointFeatures = pointFeatures.concat(node.toFeatureArray());
			return [
				...polygonFeatures,
				...stringFeatures,
				...pointFeatures
			];
		}
	};
}));
//#endregion
//#region src/ref-elements.ts
var RefElements;
var init_ref_elements = __esmMin((() => {
	RefElements = class extends Map {
		constructor() {
			super();
			this.binders = [];
		}
		add(k, v) {
			this.set(k, v);
		}
		addBinder(binder) {
			this.binders.push(binder);
		}
		bindAll() {
			this.binders.forEach((binder) => binder.bind());
		}
	};
}));
//#endregion
//#region src/index.ts
var require_src = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	init_utils();
	init_node();
	init_way();
	init_relation();
	init_ref_elements();
	function parseOptions(options) {
		if (!options) return {
			completeFeature: false,
			renderTagged: false,
			excludeWay: true
		};
		let excludeWay = options.excludeWay === void 0 || options.excludeWay;
		return {
			completeFeature: options.completeFeature ? true : false,
			renderTagged: options.renderTagged ? true : false,
			excludeWay
		};
	}
	function detectFormat(o) {
		if (o.elements) return "json";
		if (o.indexOf("<osm") >= 0) return "xml";
		if (o.trim().startsWith("{")) return "json-raw";
		return "invalid";
	}
	function analyzeFeaturesFromJson(osm, refElements) {
		for (const elem of osm.elements) switch (elem.type) {
			case "node":
				const node = new Node(elem.id, refElements);
				if (elem.tags) node.addTags(elem.tags);
				node.addProps(purgeProps(elem, [
					"id",
					"type",
					"tags",
					"lat",
					"lon"
				]));
				node.setLatLng(elem);
				break;
			case "way":
				const way = new Way(elem.id, refElements);
				if (elem.tags) way.addTags(elem.tags);
				way.addProps(purgeProps(elem, [
					"id",
					"type",
					"tags",
					"nodes",
					"geometry"
				]));
				if (elem.geometry) way.setLatLngArray(elem.geometry);
				else if (elem.nodes) for (const n of elem.nodes) way.addNodeRef(n);
				break;
			case "relation":
				const relation = new Relation(elem.id, refElements);
				if (elem.bounds) relation.setBounds([
					parseFloat(elem.bounds.minlon),
					parseFloat(elem.bounds.minlat),
					parseFloat(elem.bounds.maxlon),
					parseFloat(elem.bounds.maxlat)
				]);
				if (elem.tags) relation.addTags(elem.tags);
				relation.addProps(purgeProps(elem, [
					"id",
					"type",
					"tags",
					"bounds",
					"members"
				]));
				if (elem.members) for (const member of elem.members) relation.addMember(member);
			default: break;
		}
	}
	function analyzeFeaturesFromXml(osm, refElements) {
		const xmlParser = new XmlParser({ progressive: true });
		xmlParser.on("</osm.node>", (node) => {
			const nd = new Node(node.id, refElements);
			for (const [k, v] of Object.entries(node)) if (!k.startsWith("$") && [
				"id",
				"lon",
				"lat"
			].indexOf(k) < 0) nd.addProp(k, v);
			nd.setLatLng(node);
			if (node.$innerNodes) {
				for (const ind of node.$innerNodes) if (ind.$tag === "tag") nd.addTag(ind.k, ind.v);
			}
		});
		xmlParser.on("</osm.way>", (node) => {
			const way = new Way(node.id, refElements);
			for (const [k, v] of Object.entries(node)) if (!k.startsWith("$") && ["id"].indexOf(k) < 0) way.addProp(k, v);
			if (node.$innerNodes) {
				for (const ind of node.$innerNodes) if (ind.$tag === "nd") {
					if (ind.lon && ind.lat) way.addLatLng(ind);
					else if (ind.ref) way.addNodeRef(ind.ref);
				} else if (ind.$tag === "tag") way.addTag(ind.k, ind.v);
			}
		});
		xmlParser.on("<osm.relation>", (node) => new Relation(node.id, refElements));
		xmlParser.on("</osm.relation.member>", (node, parent) => {
			const relation = refElements.get(`relation/${parent?.id}`);
			const member = {
				type: node.type,
				role: node.role ? node.role : "",
				ref: node.ref
			};
			if (node.lat && node.lon) {
				member.lat = node.lat, member.lon = node.lon, member.tags = {};
				for (const [k, v] of Object.entries(node)) if (!k.startsWith("$") && [
					"type",
					"lat",
					"lon"
				].indexOf(k) < 0) member[k] = v;
			}
			if (node.$innerNodes) {
				const geometry = [];
				const nodes = [];
				for (const ind of node.$innerNodes) if (ind.lat && ind.lon) geometry.push(ind);
				else if (ind.ref) nodes.push(ind.ref);
				if (geometry.length > 0) member.geometry = geometry;
				else if (nodes.length > 0) member.nodes = nodes;
			}
			relation.addMember(member);
		});
		xmlParser.on("</osm.relation.bounds>", (node, parent) => {
			refElements.get(`relation/${parent?.id}`).setBounds([
				parseFloat(node.minlon),
				parseFloat(node.minlat),
				parseFloat(node.maxlon),
				parseFloat(node.maxlat)
			]);
		});
		xmlParser.on("</osm.relation.tag>", (node, parent) => {
			refElements.get(`relation/${parent?.id}`).addTag(node.k, node.v);
		});
		xmlParser.parse(osm);
	}
	function osm2geojson(osm, opts) {
		let { completeFeature, renderTagged, excludeWay } = parseOptions(opts);
		let format = detectFormat(osm);
		const refElements = new RefElements();
		let featureArray = [];
		if (format === "json-raw") {
			osm = JSON.parse(osm);
			if (osm.elements) format = "json";
			else format = "invalid";
		}
		if (format === "json") analyzeFeaturesFromJson(osm, refElements);
		else if (format === "xml") analyzeFeaturesFromXml(osm, refElements);
		refElements.bindAll();
		for (const v of refElements.values()) {
			if (v.refCount > 0 && (!v.hasTag || !renderTagged || v instanceof Way && excludeWay)) continue;
			const features = v.toFeatureArray();
			if (v instanceof Relation && !completeFeature && features.length > 0) return features[0].geometry;
			featureArray = featureArray.concat(features);
		}
		return {
			type: "FeatureCollection",
			features: featureArray
		};
	}
	module.exports = osm2geojson;
}));
//#endregion
export default require_src();
