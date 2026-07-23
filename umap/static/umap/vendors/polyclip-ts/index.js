// src/geom-in.ts
import BigNumber2 from "bignumber.js";

// src/constant.ts
var constant_default = (x) => {
  return () => {
    return x;
  };
};

// src/compare.ts
var compare_default = (eps) => {
  const almostEqual = eps ? (a, b) => b.minus(a).abs().isLessThanOrEqualTo(eps) : constant_default(false);
  return (a, b) => {
    if (almostEqual(a, b)) return 0;
    return a.comparedTo(b);
  };
};

// src/orient.ts
function orient_default(eps) {
  const almostCollinear = eps ? (area2, ax, ay, cx, cy) => area2.exponentiatedBy(2).isLessThanOrEqualTo(
    cx.minus(ax).exponentiatedBy(2).plus(cy.minus(ay).exponentiatedBy(2)).times(eps)
  ) : constant_default(false);
  return (a, b, c) => {
    const ax = a.x, ay = a.y, cx = c.x, cy = c.y;
    const area2 = ay.minus(cy).times(b.x.minus(cx)).minus(ax.minus(cx).times(b.y.minus(cy)));
    if (almostCollinear(area2, ax, ay, cx, cy)) return 0;
    return area2.comparedTo(0);
  };
}

// src/snap.ts
import BigNumber from "bignumber.js";
import { SplayTreeSet } from "splaytree-ts";

// src/identity.ts
var identity_default = (x) => {
  return x;
};

// src/snap.ts
var snap_default = (eps) => {
  if (eps) {
    const xTree = new SplayTreeSet(compare_default(eps));
    const yTree = new SplayTreeSet(compare_default(eps));
    const snapCoord = (coord, tree) => {
      return tree.addAndReturn(coord);
    };
    const snap = (v) => {
      return {
        x: snapCoord(v.x, xTree),
        y: snapCoord(v.y, yTree)
      };
    };
    snap({ x: new BigNumber(0), y: new BigNumber(0) });
    return snap;
  }
  return identity_default;
};

// src/precision.ts
var set = (eps) => {
  return {
    set: (eps2) => {
      precision = set(eps2);
    },
    reset: () => set(eps),
    compare: compare_default(eps),
    snap: snap_default(eps),
    orient: orient_default(eps)
  };
};
var precision = set();

// src/bbox.ts
var isInBbox = (bbox, point) => {
  return bbox.ll.x.isLessThanOrEqualTo(point.x) && point.x.isLessThanOrEqualTo(bbox.ur.x) && bbox.ll.y.isLessThanOrEqualTo(point.y) && point.y.isLessThanOrEqualTo(bbox.ur.y);
};
var getBboxOverlap = (b1, b2) => {
  if (b2.ur.x.isLessThan(b1.ll.x) || b1.ur.x.isLessThan(b2.ll.x) || b2.ur.y.isLessThan(b1.ll.y) || b1.ur.y.isLessThan(b2.ll.y))
    return null;
  const lowerX = b1.ll.x.isLessThan(b2.ll.x) ? b2.ll.x : b1.ll.x;
  const upperX = b1.ur.x.isLessThan(b2.ur.x) ? b1.ur.x : b2.ur.x;
  const lowerY = b1.ll.y.isLessThan(b2.ll.y) ? b2.ll.y : b1.ll.y;
  const upperY = b1.ur.y.isLessThan(b2.ur.y) ? b1.ur.y : b2.ur.y;
  return { ll: { x: lowerX, y: lowerY }, ur: { x: upperX, y: upperY } };
};

// src/operation.ts
import { SplayTreeSet as SplayTreeSet3 } from "splaytree-ts";

// src/vector.ts
var crossProduct = (a, b) => a.x.times(b.y).minus(a.y.times(b.x));
var dotProduct = (a, b) => a.x.times(b.x).plus(a.y.times(b.y));
var length = (v) => dotProduct(v, v).sqrt();
var sineOfAngle = (pShared, pBase, pAngle) => {
  const vBase = { x: pBase.x.minus(pShared.x), y: pBase.y.minus(pShared.y) };
  const vAngle = { x: pAngle.x.minus(pShared.x), y: pAngle.y.minus(pShared.y) };
  return crossProduct(vAngle, vBase).div(length(vAngle)).div(length(vBase));
};
var cosineOfAngle = (pShared, pBase, pAngle) => {
  const vBase = { x: pBase.x.minus(pShared.x), y: pBase.y.minus(pShared.y) };
  const vAngle = { x: pAngle.x.minus(pShared.x), y: pAngle.y.minus(pShared.y) };
  return dotProduct(vAngle, vBase).div(length(vAngle)).div(length(vBase));
};
var horizontalIntersection = (pt, v, y) => {
  if (v.y.isZero()) return null;
  return { x: pt.x.plus(v.x.div(v.y).times(y.minus(pt.y))), y };
};
var verticalIntersection = (pt, v, x) => {
  if (v.x.isZero()) return null;
  return { x, y: pt.y.plus(v.y.div(v.x).times(x.minus(pt.x))) };
};
var intersection = (pt1, v1, pt2, v2) => {
  if (v1.x.isZero()) return verticalIntersection(pt2, v2, pt1.x);
  if (v2.x.isZero()) return verticalIntersection(pt1, v1, pt2.x);
  if (v1.y.isZero()) return horizontalIntersection(pt2, v2, pt1.y);
  if (v2.y.isZero()) return horizontalIntersection(pt1, v1, pt2.y);
  const kross = crossProduct(v1, v2);
  if (kross.isZero()) return null;
  const ve = { x: pt2.x.minus(pt1.x), y: pt2.y.minus(pt1.y) };
  const d1 = crossProduct(ve, v1).div(kross);
  const d2 = crossProduct(ve, v2).div(kross);
  const x1 = pt1.x.plus(d2.times(v1.x)), x2 = pt2.x.plus(d1.times(v2.x));
  const y1 = pt1.y.plus(d2.times(v1.y)), y2 = pt2.y.plus(d1.times(v2.y));
  const x = x1.plus(x2).div(2);
  const y = y1.plus(y2).div(2);
  return { x, y };
};

// src/sweep-event.ts
var SweepEvent = class _SweepEvent {
  point;
  isLeft;
  segment;
  otherSE;
  consumedBy;
  // for ordering sweep events in the sweep event queue
  static compare(a, b) {
    const ptCmp = _SweepEvent.comparePoints(a.point, b.point);
    if (ptCmp !== 0) return ptCmp;
    if (a.point !== b.point) a.link(b);
    if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;
    return Segment.compare(a.segment, b.segment);
  }
  // for ordering points in sweep line order
  static comparePoints(aPt, bPt) {
    if (aPt.x.isLessThan(bPt.x)) return -1;
    if (aPt.x.isGreaterThan(bPt.x)) return 1;
    if (aPt.y.isLessThan(bPt.y)) return -1;
    if (aPt.y.isGreaterThan(bPt.y)) return 1;
    return 0;
  }
  // Warning: 'point' input will be modified and re-used (for performance)
  constructor(point, isLeft) {
    if (point.events === void 0) point.events = [this];
    else point.events.push(this);
    this.point = point;
    this.isLeft = isLeft;
  }
  link(other) {
    if (other.point === this.point) {
      throw new Error("Tried to link already linked events");
    }
    const otherEvents = other.point.events;
    for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
      const evt = otherEvents[i];
      this.point.events.push(evt);
      evt.point = this.point;
    }
    this.checkForConsuming();
  }
  /* Do a pass over our linked events and check to see if any pair
   * of segments match, and should be consumed. */
  checkForConsuming() {
    const numEvents = this.point.events.length;
    for (let i = 0; i < numEvents; i++) {
      const evt1 = this.point.events[i];
      if (evt1.segment.consumedBy !== void 0) continue;
      for (let j = i + 1; j < numEvents; j++) {
        const evt2 = this.point.events[j];
        if (evt2.consumedBy !== void 0) continue;
        if (evt1.otherSE.point.events !== evt2.otherSE.point.events) continue;
        evt1.segment.consume(evt2.segment);
      }
    }
  }
  getAvailableLinkedEvents() {
    const events = [];
    for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
      const evt = this.point.events[i];
      if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
        events.push(evt);
      }
    }
    return events;
  }
  /**
   * Returns a comparator function for sorting linked events that will
   * favor the event that will give us the smallest left-side angle.
   * All ring construction starts as low as possible heading to the right,
   * so by always turning left as sharp as possible we'll get polygons
   * without uncessary loops & holes.
   *
   * The comparator function has a compute cache such that it avoids
   * re-computing already-computed values.
   */
  getLeftmostComparator(baseEvent) {
    const cache = /* @__PURE__ */ new Map();
    const fillCache = (linkedEvent) => {
      const nextEvent = linkedEvent.otherSE;
      cache.set(linkedEvent, {
        sine: sineOfAngle(this.point, baseEvent.point, nextEvent.point),
        cosine: cosineOfAngle(this.point, baseEvent.point, nextEvent.point)
      });
    };
    return (a, b) => {
      if (!cache.has(a)) fillCache(a);
      if (!cache.has(b)) fillCache(b);
      const { sine: asine, cosine: acosine } = cache.get(a);
      const { sine: bsine, cosine: bcosine } = cache.get(b);
      if (asine.isGreaterThanOrEqualTo(0) && bsine.isGreaterThanOrEqualTo(0)) {
        if (acosine.isLessThan(bcosine)) return 1;
        if (acosine.isGreaterThan(bcosine)) return -1;
        return 0;
      }
      if (asine.isLessThan(0) && bsine.isLessThan(0)) {
        if (acosine.isLessThan(bcosine)) return -1;
        if (acosine.isGreaterThan(bcosine)) return 1;
        return 0;
      }
      if (bsine.isLessThan(asine)) return -1;
      if (bsine.isGreaterThan(asine)) return 1;
      return 0;
    };
  }
};

// src/geom-out.ts
var RingOut = class _RingOut {
  events;
  poly;
  _isExteriorRing;
  _enclosingRing;
  /* Given the segments from the sweep line pass, compute & return a series
   * of closed rings from all the segments marked to be part of the result */
  static factory(allSegments) {
    const ringsOut = [];
    for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
      const segment = allSegments[i];
      if (!segment.isInResult() || segment.ringOut) continue;
      let prevEvent = null;
      let event = segment.leftSE;
      let nextEvent = segment.rightSE;
      const events = [event];
      const startingPoint = event.point;
      const intersectionLEs = [];
      while (true) {
        prevEvent = event;
        event = nextEvent;
        events.push(event);
        if (event.point === startingPoint) break;
        while (true) {
          const availableLEs = event.getAvailableLinkedEvents();
          if (availableLEs.length === 0) {
            const firstPt = events[0].point;
            const lastPt = events[events.length - 1].point;
            throw new Error(
              `Unable to complete output ring starting at [${firstPt.x}, ${firstPt.y}]. Last matching segment found ends at [${lastPt.x}, ${lastPt.y}].`
            );
          }
          if (availableLEs.length === 1) {
            nextEvent = availableLEs[0].otherSE;
            break;
          }
          let indexLE = null;
          for (let j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
            if (intersectionLEs[j].point === event.point) {
              indexLE = j;
              break;
            }
          }
          if (indexLE !== null) {
            const intersectionLE = intersectionLEs.splice(indexLE)[0];
            const ringEvents = events.splice(intersectionLE.index);
            ringEvents.unshift(ringEvents[0].otherSE);
            ringsOut.push(new _RingOut(ringEvents.reverse()));
            continue;
          }
          intersectionLEs.push({
            index: events.length,
            point: event.point
          });
          const comparator = event.getLeftmostComparator(prevEvent);
          nextEvent = availableLEs.sort(comparator)[0].otherSE;
          break;
        }
      }
      ringsOut.push(new _RingOut(events));
    }
    return ringsOut;
  }
  constructor(events) {
    this.events = events;
    for (let i = 0, iMax = events.length; i < iMax; i++) {
      events[i].segment.ringOut = this;
    }
    this.poly = null;
  }
  getGeom() {
    let prevPt = this.events[0].point;
    const points = [prevPt];
    for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
      const pt2 = this.events[i].point;
      const nextPt2 = this.events[i + 1].point;
      if (precision.orient(pt2, prevPt, nextPt2) === 0) continue;
      points.push(pt2);
      prevPt = pt2;
    }
    if (points.length === 1) return null;
    const pt = points[0];
    const nextPt = points[1];
    if (precision.orient(pt, prevPt, nextPt) === 0) points.shift();
    points.push(points[0]);
    const step = this.isExteriorRing() ? 1 : -1;
    const iStart = this.isExteriorRing() ? 0 : points.length - 1;
    const iEnd = this.isExteriorRing() ? points.length : -1;
    const orderedPoints = [];
    for (let i = iStart; i != iEnd; i += step)
      orderedPoints.push([points[i].x.toNumber(), points[i].y.toNumber()]);
    return orderedPoints;
  }
  isExteriorRing() {
    if (this._isExteriorRing === void 0) {
      const enclosing = this.enclosingRing();
      this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
    }
    return this._isExteriorRing;
  }
  enclosingRing() {
    if (this._enclosingRing === void 0) {
      this._enclosingRing = this._calcEnclosingRing();
    }
    return this._enclosingRing;
  }
  /* Returns the ring that encloses this one, if any */
  _calcEnclosingRing() {
    let leftMostEvt = this.events[0];
    for (let i = 1, iMax = this.events.length; i < iMax; i++) {
      const evt = this.events[i];
      if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
    }
    let prevSeg = leftMostEvt.segment.prevInResult();
    let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
    while (true) {
      if (!prevSeg) return null;
      if (!prevPrevSeg) return prevSeg.ringOut;
      if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
        if (prevPrevSeg.ringOut?.enclosingRing() !== prevSeg.ringOut) {
          return prevSeg.ringOut;
        } else return prevSeg.ringOut?.enclosingRing();
      }
      prevSeg = prevPrevSeg.prevInResult();
      prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
    }
  }
};
var PolyOut = class {
  exteriorRing;
  interiorRings;
  constructor(exteriorRing) {
    this.exteriorRing = exteriorRing;
    exteriorRing.poly = this;
    this.interiorRings = [];
  }
  addInterior(ring) {
    this.interiorRings.push(ring);
    ring.poly = this;
  }
  getGeom() {
    const geom0 = this.exteriorRing.getGeom();
    if (geom0 === null) return null;
    const geom = [geom0];
    for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
      const ringGeom = this.interiorRings[i].getGeom();
      if (ringGeom === null) continue;
      geom.push(ringGeom);
    }
    return geom;
  }
};
var MultiPolyOut = class {
  rings;
  polys;
  constructor(rings) {
    this.rings = rings;
    this.polys = this._composePolys(rings);
  }
  getGeom() {
    const geom = [];
    for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
      const polyGeom = this.polys[i].getGeom();
      if (polyGeom === null) continue;
      geom.push(polyGeom);
    }
    return geom;
  }
  _composePolys(rings) {
    const polys = [];
    for (let i = 0, iMax = rings.length; i < iMax; i++) {
      const ring = rings[i];
      if (ring.poly) continue;
      if (ring.isExteriorRing()) polys.push(new PolyOut(ring));
      else {
        const enclosingRing = ring.enclosingRing();
        if (!enclosingRing?.poly) polys.push(new PolyOut(enclosingRing));
        enclosingRing?.poly?.addInterior(ring);
      }
    }
    return polys;
  }
};

// src/sweep-line.ts
import { SplayTreeSet as SplayTreeSet2 } from "splaytree-ts";
var SweepLine = class {
  queue;
  tree;
  segments;
  constructor(queue, comparator = Segment.compare) {
    this.queue = queue;
    this.tree = new SplayTreeSet2(comparator);
    this.segments = [];
  }
  process(event) {
    const segment = event.segment;
    const newEvents = [];
    if (event.consumedBy) {
      if (event.isLeft) this.queue.delete(event.otherSE);
      else this.tree.delete(segment);
      return newEvents;
    }
    if (event.isLeft) this.tree.add(segment);
    let prevSeg = segment;
    let nextSeg = segment;
    do {
      prevSeg = this.tree.lastBefore(prevSeg);
    } while (prevSeg != null && prevSeg.consumedBy != void 0);
    do {
      nextSeg = this.tree.firstAfter(nextSeg);
    } while (nextSeg != null && nextSeg.consumedBy != void 0);
    if (event.isLeft) {
      let prevMySplitter = null;
      if (prevSeg) {
        const prevInter = prevSeg.getIntersection(segment);
        if (prevInter !== null) {
          if (!segment.isAnEndpoint(prevInter)) prevMySplitter = prevInter;
          if (!prevSeg.isAnEndpoint(prevInter)) {
            const newEventsFromSplit = this._splitSafely(prevSeg, prevInter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
        }
      }
      let nextMySplitter = null;
      if (nextSeg) {
        const nextInter = nextSeg.getIntersection(segment);
        if (nextInter !== null) {
          if (!segment.isAnEndpoint(nextInter)) nextMySplitter = nextInter;
          if (!nextSeg.isAnEndpoint(nextInter)) {
            const newEventsFromSplit = this._splitSafely(nextSeg, nextInter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
        }
      }
      if (prevMySplitter !== null || nextMySplitter !== null) {
        let mySplitter = null;
        if (prevMySplitter === null) mySplitter = nextMySplitter;
        else if (nextMySplitter === null) mySplitter = prevMySplitter;
        else {
          const cmpSplitters = SweepEvent.comparePoints(
            prevMySplitter,
            nextMySplitter
          );
          mySplitter = cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
        }
        this.queue.delete(segment.rightSE);
        newEvents.push(segment.rightSE);
        const newEventsFromSplit = segment.split(mySplitter);
        for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
          newEvents.push(newEventsFromSplit[i]);
        }
      }
      if (newEvents.length > 0) {
        this.tree.delete(segment);
        newEvents.push(event);
      } else {
        this.segments.push(segment);
        segment.prev = prevSeg;
      }
    } else {
      if (prevSeg && nextSeg) {
        const inter = prevSeg.getIntersection(nextSeg);
        if (inter !== null) {
          if (!prevSeg.isAnEndpoint(inter)) {
            const newEventsFromSplit = this._splitSafely(prevSeg, inter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
          if (!nextSeg.isAnEndpoint(inter)) {
            const newEventsFromSplit = this._splitSafely(nextSeg, inter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
        }
      }
      this.tree.delete(segment);
    }
    return newEvents;
  }
  /* Safely split a segment that is currently in the datastructures
   * IE - a segment other than the one that is currently being processed. */
  _splitSafely(seg, pt) {
    this.tree.delete(seg);
    const rightSE = seg.rightSE;
    this.queue.delete(rightSE);
    const newEvents = seg.split(pt);
    newEvents.push(rightSE);
    if (seg.consumedBy === void 0) this.tree.add(seg);
    return newEvents;
  }
};

// src/operation.ts
var Operation = class {
  type;
  numMultiPolys;
  run(type, geom, moreGeoms) {
    operation.type = type;
    const multipolys = [new MultiPolyIn(geom, true)];
    for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
      multipolys.push(new MultiPolyIn(moreGeoms[i], false));
    }
    operation.numMultiPolys = multipolys.length;
    if (operation.type === "difference") {
      const subject = multipolys[0];
      let i = 1;
      while (i < multipolys.length) {
        if (getBboxOverlap(multipolys[i].bbox, subject.bbox) !== null) i++;
        else multipolys.splice(i, 1);
      }
    }
    if (operation.type === "intersection") {
      for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
        const mpA = multipolys[i];
        for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
          if (getBboxOverlap(mpA.bbox, multipolys[j].bbox) === null) return [];
        }
      }
    }
    const queue = new SplayTreeSet3(SweepEvent.compare);
    for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
      const sweepEvents = multipolys[i].getSweepEvents();
      for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
        queue.add(sweepEvents[j]);
      }
    }
    const sweepLine = new SweepLine(queue);
    let evt = null;
    if (queue.size != 0) {
      evt = queue.first();
      queue.delete(evt);
    }
    while (evt) {
      const newEvents = sweepLine.process(evt);
      for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
        const evt2 = newEvents[i];
        if (evt2.consumedBy === void 0) queue.add(evt2);
      }
      if (queue.size != 0) {
        evt = queue.first();
        queue.delete(evt);
      } else {
        evt = null;
      }
    }
    precision.reset();
    const ringsOut = RingOut.factory(sweepLine.segments);
    const result = new MultiPolyOut(ringsOut);
    return result.getGeom();
  }
};
var operation = new Operation();
var operation_default = operation;

// src/segment.ts
var segmentId = 0;
var Segment = class _Segment {
  id;
  leftSE;
  rightSE;
  rings;
  windings;
  ringOut;
  consumedBy;
  prev;
  _prevInResult;
  _beforeState;
  _afterState;
  _isInResult;
  /* This compare() function is for ordering segments in the sweep
   * line tree, and does so according to the following criteria:
   *
   * Consider the vertical line that lies an infinestimal step to the
   * right of the right-more of the two left endpoints of the input
   * segments. Imagine slowly moving a point up from negative infinity
   * in the increasing y direction. Which of the two segments will that
   * point intersect first? That segment comes 'before' the other one.
   *
   * If neither segment would be intersected by such a line, (if one
   * or more of the segments are vertical) then the line to be considered
   * is directly on the right-more of the two left inputs.
   */
  static compare(a, b) {
    const alx = a.leftSE.point.x;
    const blx = b.leftSE.point.x;
    const arx = a.rightSE.point.x;
    const brx = b.rightSE.point.x;
    if (brx.isLessThan(alx)) return 1;
    if (arx.isLessThan(blx)) return -1;
    const aly = a.leftSE.point.y;
    const bly = b.leftSE.point.y;
    const ary = a.rightSE.point.y;
    const bry = b.rightSE.point.y;
    if (alx.isLessThan(blx)) {
      if (bly.isLessThan(aly) && bly.isLessThan(ary)) return 1;
      if (bly.isGreaterThan(aly) && bly.isGreaterThan(ary)) return -1;
      const aCmpBLeft = a.comparePoint(b.leftSE.point);
      if (aCmpBLeft < 0) return 1;
      if (aCmpBLeft > 0) return -1;
      const bCmpARight = b.comparePoint(a.rightSE.point);
      if (bCmpARight !== 0) return bCmpARight;
      return -1;
    }
    if (alx.isGreaterThan(blx)) {
      if (aly.isLessThan(bly) && aly.isLessThan(bry)) return -1;
      if (aly.isGreaterThan(bly) && aly.isGreaterThan(bry)) return 1;
      const bCmpALeft = b.comparePoint(a.leftSE.point);
      if (bCmpALeft !== 0) return bCmpALeft;
      const aCmpBRight = a.comparePoint(b.rightSE.point);
      if (aCmpBRight < 0) return 1;
      if (aCmpBRight > 0) return -1;
      return 1;
    }
    if (aly.isLessThan(bly)) return -1;
    if (aly.isGreaterThan(bly)) return 1;
    if (arx.isLessThan(brx)) {
      const bCmpARight = b.comparePoint(a.rightSE.point);
      if (bCmpARight !== 0) return bCmpARight;
    }
    if (arx.isGreaterThan(brx)) {
      const aCmpBRight = a.comparePoint(b.rightSE.point);
      if (aCmpBRight < 0) return 1;
      if (aCmpBRight > 0) return -1;
    }
    if (!arx.eq(brx)) {
      const ay = ary.minus(aly);
      const ax = arx.minus(alx);
      const by = bry.minus(bly);
      const bx = brx.minus(blx);
      if (ay.isGreaterThan(ax) && by.isLessThan(bx)) return 1;
      if (ay.isLessThan(ax) && by.isGreaterThan(bx)) return -1;
    }
    if (arx.isGreaterThan(brx)) return 1;
    if (arx.isLessThan(brx)) return -1;
    if (ary.isLessThan(bry)) return -1;
    if (ary.isGreaterThan(bry)) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  }
  /* Warning: a reference to ringWindings input will be stored,
   *  and possibly will be later modified */
  constructor(leftSE, rightSE, rings, windings) {
    this.id = ++segmentId;
    this.leftSE = leftSE;
    leftSE.segment = this;
    leftSE.otherSE = rightSE;
    this.rightSE = rightSE;
    rightSE.segment = this;
    rightSE.otherSE = leftSE;
    this.rings = rings;
    this.windings = windings;
  }
  static fromRing(pt1, pt2, ring) {
    let leftPt, rightPt, winding;
    const cmpPts = SweepEvent.comparePoints(pt1, pt2);
    if (cmpPts < 0) {
      leftPt = pt1;
      rightPt = pt2;
      winding = 1;
    } else if (cmpPts > 0) {
      leftPt = pt2;
      rightPt = pt1;
      winding = -1;
    } else
      throw new Error(
        `Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`
      );
    const leftSE = new SweepEvent(leftPt, true);
    const rightSE = new SweepEvent(rightPt, false);
    return new _Segment(leftSE, rightSE, [ring], [winding]);
  }
  /* When a segment is split, the rightSE is replaced with a new sweep event */
  replaceRightSE(newRightSE) {
    this.rightSE = newRightSE;
    this.rightSE.segment = this;
    this.rightSE.otherSE = this.leftSE;
    this.leftSE.otherSE = this.rightSE;
  }
  bbox() {
    const y1 = this.leftSE.point.y;
    const y2 = this.rightSE.point.y;
    return {
      ll: { x: this.leftSE.point.x, y: y1.isLessThan(y2) ? y1 : y2 },
      ur: { x: this.rightSE.point.x, y: y1.isGreaterThan(y2) ? y1 : y2 }
    };
  }
  /* A vector from the left point to the right */
  vector() {
    return {
      x: this.rightSE.point.x.minus(this.leftSE.point.x),
      y: this.rightSE.point.y.minus(this.leftSE.point.y)
    };
  }
  isAnEndpoint(pt) {
    return pt.x.eq(this.leftSE.point.x) && pt.y.eq(this.leftSE.point.y) || pt.x.eq(this.rightSE.point.x) && pt.y.eq(this.rightSE.point.y);
  }
  /* Compare this segment with a point.
   *
   * A point P is considered to be colinear to a segment if there
   * exists a distance D such that if we travel along the segment
   * from one * endpoint towards the other a distance D, we find
   * ourselves at point P.
   *
   * Return value indicates:
   *
   *   1: point lies above the segment (to the left of vertical)
   *   0: point is colinear to segment
   *  -1: point lies below the segment (to the right of vertical)
   */
  comparePoint(point) {
    return precision.orient(this.leftSE.point, point, this.rightSE.point);
  }
  /**
   * Given another segment, returns the first non-trivial intersection
   * between the two segments (in terms of sweep line ordering), if it exists.
   *
   * A 'non-trivial' intersection is one that will cause one or both of the
   * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
   *
   *   * endpoint of segA with endpoint of segB --> trivial
   *   * endpoint of segA with point along segB --> non-trivial
   *   * endpoint of segB with point along segA --> non-trivial
   *   * point along segA with point along segB --> non-trivial
   *
   * If no non-trivial intersection exists, return null
   * Else, return null.
   */
  getIntersection(other) {
    const tBbox = this.bbox();
    const oBbox = other.bbox();
    const bboxOverlap = getBboxOverlap(tBbox, oBbox);
    if (bboxOverlap === null) return null;
    const tlp = this.leftSE.point;
    const trp = this.rightSE.point;
    const olp = other.leftSE.point;
    const orp = other.rightSE.point;
    const touchesOtherLSE = isInBbox(tBbox, olp) && this.comparePoint(olp) === 0;
    const touchesThisLSE = isInBbox(oBbox, tlp) && other.comparePoint(tlp) === 0;
    const touchesOtherRSE = isInBbox(tBbox, orp) && this.comparePoint(orp) === 0;
    const touchesThisRSE = isInBbox(oBbox, trp) && other.comparePoint(trp) === 0;
    if (touchesThisLSE && touchesOtherLSE) {
      if (touchesThisRSE && !touchesOtherRSE) return trp;
      if (!touchesThisRSE && touchesOtherRSE) return orp;
      return null;
    }
    if (touchesThisLSE) {
      if (touchesOtherRSE) {
        if (tlp.x.eq(orp.x) && tlp.y.eq(orp.y)) return null;
      }
      return tlp;
    }
    if (touchesOtherLSE) {
      if (touchesThisRSE) {
        if (trp.x.eq(olp.x) && trp.y.eq(olp.y)) return null;
      }
      return olp;
    }
    if (touchesThisRSE && touchesOtherRSE) return null;
    if (touchesThisRSE) return trp;
    if (touchesOtherRSE) return orp;
    const pt = intersection(tlp, this.vector(), olp, other.vector());
    if (pt === null) return null;
    if (!isInBbox(bboxOverlap, pt)) return null;
    return precision.snap(pt);
  }
  /**
   * Split the given segment into multiple segments on the given points.
   *  * Each existing segment will retain its leftSE and a new rightSE will be
   *    generated for it.
   *  * A new segment will be generated which will adopt the original segment's
   *    rightSE, and a new leftSE will be generated for it.
   *  * If there are more than two points given to split on, new segments
   *    in the middle will be generated with new leftSE and rightSE's.
   *  * An array of the newly generated SweepEvents will be returned.
   *
   * Warning: input array of points is modified
   */
  split(point) {
    const newEvents = [];
    const alreadyLinked = point.events !== void 0;
    const newLeftSE = new SweepEvent(point, true);
    const newRightSE = new SweepEvent(point, false);
    const oldRightSE = this.rightSE;
    this.replaceRightSE(newRightSE);
    newEvents.push(newRightSE);
    newEvents.push(newLeftSE);
    const newSeg = new _Segment(
      newLeftSE,
      oldRightSE,
      this.rings.slice(),
      this.windings.slice()
    );
    if (SweepEvent.comparePoints(newSeg.leftSE.point, newSeg.rightSE.point) > 0) {
      newSeg.swapEvents();
    }
    if (SweepEvent.comparePoints(this.leftSE.point, this.rightSE.point) > 0) {
      this.swapEvents();
    }
    if (alreadyLinked) {
      newLeftSE.checkForConsuming();
      newRightSE.checkForConsuming();
    }
    return newEvents;
  }
  /* Swap which event is left and right */
  swapEvents() {
    const tmpEvt = this.rightSE;
    this.rightSE = this.leftSE;
    this.leftSE = tmpEvt;
    this.leftSE.isLeft = true;
    this.rightSE.isLeft = false;
    for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
      this.windings[i] *= -1;
    }
  }
  /* Consume another segment. We take their rings under our wing
   * and mark them as consumed. Use for perfectly overlapping segments */
  consume(other) {
    let consumer = this;
    let consumee = other;
    while (consumer.consumedBy) consumer = consumer.consumedBy;
    while (consumee.consumedBy) consumee = consumee.consumedBy;
    const cmp = _Segment.compare(consumer, consumee);
    if (cmp === 0) return;
    if (cmp > 0) {
      const tmp = consumer;
      consumer = consumee;
      consumee = tmp;
    }
    if (consumer.prev === consumee) {
      const tmp = consumer;
      consumer = consumee;
      consumee = tmp;
    }
    for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
      const ring = consumee.rings[i];
      const winding = consumee.windings[i];
      const index = consumer.rings.indexOf(ring);
      if (index === -1) {
        consumer.rings.push(ring);
        consumer.windings.push(winding);
      } else consumer.windings[index] += winding;
    }
    consumee.rings = null;
    consumee.windings = null;
    consumee.consumedBy = consumer;
    consumee.leftSE.consumedBy = consumer.leftSE;
    consumee.rightSE.consumedBy = consumer.rightSE;
  }
  /* The first segment previous segment chain that is in the result */
  prevInResult() {
    if (this._prevInResult !== void 0) return this._prevInResult;
    if (!this.prev) this._prevInResult = null;
    else if (this.prev.isInResult()) this._prevInResult = this.prev;
    else this._prevInResult = this.prev.prevInResult();
    return this._prevInResult;
  }
  beforeState() {
    if (this._beforeState !== void 0) return this._beforeState;
    if (!this.prev)
      this._beforeState = {
        rings: [],
        windings: [],
        multiPolys: []
      };
    else {
      const seg = this.prev.consumedBy || this.prev;
      this._beforeState = seg.afterState();
    }
    return this._beforeState;
  }
  afterState() {
    if (this._afterState !== void 0) return this._afterState;
    const beforeState = this.beforeState();
    this._afterState = {
      rings: beforeState.rings.slice(0),
      windings: beforeState.windings.slice(0),
      multiPolys: []
    };
    const ringsAfter = this._afterState.rings;
    const windingsAfter = this._afterState.windings;
    const mpsAfter = this._afterState.multiPolys;
    for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
      const ring = this.rings[i];
      const winding = this.windings[i];
      const index = ringsAfter.indexOf(ring);
      if (index === -1) {
        ringsAfter.push(ring);
        windingsAfter.push(winding);
      } else windingsAfter[index] += winding;
    }
    const polysAfter = [];
    const polysExclude = [];
    for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
      if (windingsAfter[i] === 0) continue;
      const ring = ringsAfter[i];
      const poly = ring.poly;
      if (polysExclude.indexOf(poly) !== -1) continue;
      if (ring.isExterior) polysAfter.push(poly);
      else {
        if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
        const index = polysAfter.indexOf(ring.poly);
        if (index !== -1) polysAfter.splice(index, 1);
      }
    }
    for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
      const mp = polysAfter[i].multiPoly;
      if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
    }
    return this._afterState;
  }
  /* Is this segment part of the final result? */
  isInResult() {
    if (this.consumedBy) return false;
    if (this._isInResult !== void 0) return this._isInResult;
    const mpsBefore = this.beforeState().multiPolys;
    const mpsAfter = this.afterState().multiPolys;
    switch (operation_default.type) {
      case "union": {
        const noBefores = mpsBefore.length === 0;
        const noAfters = mpsAfter.length === 0;
        this._isInResult = noBefores !== noAfters;
        break;
      }
      case "intersection": {
        let least;
        let most;
        if (mpsBefore.length < mpsAfter.length) {
          least = mpsBefore.length;
          most = mpsAfter.length;
        } else {
          least = mpsAfter.length;
          most = mpsBefore.length;
        }
        this._isInResult = most === operation_default.numMultiPolys && least < most;
        break;
      }
      case "xor": {
        const diff = Math.abs(mpsBefore.length - mpsAfter.length);
        this._isInResult = diff % 2 === 1;
        break;
      }
      case "difference": {
        const isJustSubject = (mps) => mps.length === 1 && mps[0].isSubject;
        this._isInResult = isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
        break;
      }
    }
    return this._isInResult;
  }
};

// src/geom-in.ts
var RingIn = class {
  poly;
  isExterior;
  segments;
  bbox;
  constructor(geomRing, poly, isExterior) {
    if (!Array.isArray(geomRing) || geomRing.length === 0) {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    this.poly = poly;
    this.isExterior = isExterior;
    this.segments = [];
    if (typeof geomRing[0][0] !== "number" || typeof geomRing[0][1] !== "number") {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    const firstPoint = precision.snap({ x: new BigNumber2(geomRing[0][0]), y: new BigNumber2(geomRing[0][1]) });
    this.bbox = {
      ll: { x: firstPoint.x, y: firstPoint.y },
      ur: { x: firstPoint.x, y: firstPoint.y }
    };
    let prevPoint = firstPoint;
    for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
      if (typeof geomRing[i][0] !== "number" || typeof geomRing[i][1] !== "number") {
        throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
      }
      const point = precision.snap({ x: new BigNumber2(geomRing[i][0]), y: new BigNumber2(geomRing[i][1]) });
      if (point.x.eq(prevPoint.x) && point.y.eq(prevPoint.y)) continue;
      this.segments.push(Segment.fromRing(prevPoint, point, this));
      if (point.x.isLessThan(this.bbox.ll.x)) this.bbox.ll.x = point.x;
      if (point.y.isLessThan(this.bbox.ll.y)) this.bbox.ll.y = point.y;
      if (point.x.isGreaterThan(this.bbox.ur.x)) this.bbox.ur.x = point.x;
      if (point.y.isGreaterThan(this.bbox.ur.y)) this.bbox.ur.y = point.y;
      prevPoint = point;
    }
    if (!firstPoint.x.eq(prevPoint.x) || !firstPoint.y.eq(prevPoint.y)) {
      this.segments.push(Segment.fromRing(prevPoint, firstPoint, this));
    }
  }
  getSweepEvents() {
    const sweepEvents = [];
    for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
      const segment = this.segments[i];
      sweepEvents.push(segment.leftSE);
      sweepEvents.push(segment.rightSE);
    }
    return sweepEvents;
  }
};
var PolyIn = class {
  multiPoly;
  exteriorRing;
  interiorRings;
  bbox;
  constructor(geomPoly, multiPoly) {
    if (!Array.isArray(geomPoly)) {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    this.exteriorRing = new RingIn(geomPoly[0], this, true);
    this.bbox = {
      ll: { x: this.exteriorRing.bbox.ll.x, y: this.exteriorRing.bbox.ll.y },
      ur: { x: this.exteriorRing.bbox.ur.x, y: this.exteriorRing.bbox.ur.y }
    };
    this.interiorRings = [];
    for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
      const ring = new RingIn(geomPoly[i], this, false);
      if (ring.bbox.ll.x.isLessThan(this.bbox.ll.x)) this.bbox.ll.x = ring.bbox.ll.x;
      if (ring.bbox.ll.y.isLessThan(this.bbox.ll.y)) this.bbox.ll.y = ring.bbox.ll.y;
      if (ring.bbox.ur.x.isGreaterThan(this.bbox.ur.x)) this.bbox.ur.x = ring.bbox.ur.x;
      if (ring.bbox.ur.y.isGreaterThan(this.bbox.ur.y)) this.bbox.ur.y = ring.bbox.ur.y;
      this.interiorRings.push(ring);
    }
    this.multiPoly = multiPoly;
  }
  getSweepEvents() {
    const sweepEvents = this.exteriorRing.getSweepEvents();
    for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
      const ringSweepEvents = this.interiorRings[i].getSweepEvents();
      for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
        sweepEvents.push(ringSweepEvents[j]);
      }
    }
    return sweepEvents;
  }
};
var MultiPolyIn = class {
  isSubject;
  polys;
  bbox;
  constructor(geom, isSubject) {
    if (!Array.isArray(geom)) {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    try {
      if (typeof geom[0][0][0] === "number") geom = [geom];
    } catch (ex) {
    }
    this.polys = [];
    this.bbox = {
      ll: { x: new BigNumber2(Number.POSITIVE_INFINITY), y: new BigNumber2(Number.POSITIVE_INFINITY) },
      ur: { x: new BigNumber2(Number.NEGATIVE_INFINITY), y: new BigNumber2(Number.NEGATIVE_INFINITY) }
    };
    for (let i = 0, iMax = geom.length; i < iMax; i++) {
      const poly = new PolyIn(geom[i], this);
      if (poly.bbox.ll.x.isLessThan(this.bbox.ll.x)) this.bbox.ll.x = poly.bbox.ll.x;
      if (poly.bbox.ll.y.isLessThan(this.bbox.ll.y)) this.bbox.ll.y = poly.bbox.ll.y;
      if (poly.bbox.ur.x.isGreaterThan(this.bbox.ur.x)) this.bbox.ur.x = poly.bbox.ur.x;
      if (poly.bbox.ur.y.isGreaterThan(this.bbox.ur.y)) this.bbox.ur.y = poly.bbox.ur.y;
      this.polys.push(poly);
    }
    this.isSubject = isSubject;
  }
  getSweepEvents() {
    const sweepEvents = [];
    for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
      const polySweepEvents = this.polys[i].getSweepEvents();
      for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
        sweepEvents.push(polySweepEvents[j]);
      }
    }
    return sweepEvents;
  }
};

// src/index.ts
var union = (geom, ...moreGeoms) => operation_default.run("union", geom, moreGeoms);
var intersection2 = (geom, ...moreGeoms) => operation_default.run("intersection", geom, moreGeoms);
var xor = (geom, ...moreGeoms) => operation_default.run("xor", geom, moreGeoms);
var difference = (geom, ...moreGeoms) => operation_default.run("difference", geom, moreGeoms);
var setPrecision = precision.set;
export {
  difference,
  intersection2 as intersection,
  setPrecision,
  union,
  xor
};
//# sourceMappingURL=index.js.map