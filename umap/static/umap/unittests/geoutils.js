import { describe, it } from 'mocha'
import pkg from 'chai'
import * as GeoUtils from '../js/modules/geoutils.js'
const { assert } = pkg

describe('GeoUtils', () => {
  describe('#unionBbox()', () => {
    it('should extend bbox', () => {
      // West, South, East, North
      const a = [2.5634, 48.52942, 2.77284, 48.48154]
      const b = [2.7261221, 48.4163927, 2.7261221, 48.4163927]
      const expected = [2.5634, 48.4163927, 2.77284, 48.48154]
      assert.deepEqual(GeoUtils.unionBbox(a, b), expected)
    })
  }),
    describe('#isFlat()', () => {
      it('should return true for GeoJSON LineString coordinates', () => {
        assert.isTrue(
          GeoUtils.isFlat([
            [1, 2],
            [3, 4],
            [5, 6],
          ])
        )
      })

      it('should return true for an array of Leaflet LatLng-like objects', () => {
        assert.isTrue(
          GeoUtils.isFlat([
            { lat: 1, lng: 2 },
            { lat: 3, lng: 4 },
          ])
        )
      })

      it('should return true for a single position', () => {
        assert.isTrue(GeoUtils.isFlat([[1, 2]]))
      })

      it('should return true for a single LatLng-like object', () => {
        assert.isTrue(GeoUtils.isFlat([{ lat: 1, lng: 2 }]))
      })

      it('should return true for an empty array', () => {
        assert.isTrue(GeoUtils.isFlat([]))
      })

      it('should return false for GeoJSON MultiLineString coordinates', () => {
        assert.isFalse(
          GeoUtils.isFlat([
            [
              [1, 2],
              [3, 4],
            ],
            [
              [5, 6],
              [7, 8],
            ],
          ])
        )
      })

      it('should return false for GeoJSON Polygon coordinates (ring of positions)', () => {
        assert.isFalse(
          GeoUtils.isFlat([
            [
              [1, 2],
              [3, 4],
              [5, 6],
              [1, 2],
            ],
          ])
        )
      })

      it('should return false for GeoJSON MultiPolygon coordinates', () => {
        assert.isFalse(
          GeoUtils.isFlat([
            [
              [
                [1, 2],
                [3, 4],
                [5, 6],
                [1, 2],
              ],
            ],
          ])
        )
      })

      it('should return false for a nested array of LatLng-like objects (Multi)', () => {
        assert.isFalse(
          GeoUtils.isFlat([
            [
              { lat: 1, lng: 2 },
              { lat: 3, lng: 4 },
            ],
            [
              { lat: 5, lng: 6 },
              { lat: 7, lng: 8 },
            ],
          ])
        )
      })

      it('should return false for an array containing an empty sub-array', () => {
        assert.isFalse(GeoUtils.isFlat([[]]))
      })
    })

  describe('#mergeGeometryCollection()', () => {
    const square = (x) => [
      [
        [x, 0],
        [x + 1, 0],
        [x + 1, 1],
        [x, 0],
      ],
    ]

    it('should merge polygons into a MultiPolygon', () => {
      assert.deepEqual(
        GeoUtils.mergeGeometryCollection({
          type: 'GeometryCollection',
          geometries: [
            { type: 'Polygon', coordinates: square(0) },
            { type: 'Polygon', coordinates: square(2) },
          ],
        }),
        { type: 'MultiPolygon', coordinates: [square(0), square(2)] }
      )
    })

    it('should merge polygons and multipolygons into a MultiPolygon', () => {
      assert.deepEqual(
        GeoUtils.mergeGeometryCollection({
          type: 'GeometryCollection',
          geometries: [
            { type: 'Polygon', coordinates: square(0) },
            { type: 'MultiPolygon', coordinates: [square(2), square(4)] },
          ],
        }),
        { type: 'MultiPolygon', coordinates: [square(0), square(2), square(4)] }
      )
    })

    it('should merge lines into a MultiLineString', () => {
      assert.deepEqual(
        GeoUtils.mergeGeometryCollection({
          type: 'GeometryCollection',
          geometries: [
            {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
            {
              type: 'MultiLineString',
              coordinates: [
                [
                  [2, 2],
                  [3, 3],
                ],
              ],
            },
          ],
        }),
        {
          type: 'MultiLineString',
          coordinates: [
            [
              [0, 0],
              [1, 1],
            ],
            [
              [2, 2],
              [3, 3],
            ],
          ],
        }
      )
    })

    it('should return null for mixed geometry types', () => {
      assert.isNull(
        GeoUtils.mergeGeometryCollection({
          type: 'GeometryCollection',
          geometries: [
            { type: 'Polygon', coordinates: square(0) },
            { type: 'Point', coordinates: [0, 0] },
          ],
        })
      )
    })

    it('should return null for points', () => {
      assert.isNull(
        GeoUtils.mergeGeometryCollection({
          type: 'GeometryCollection',
          geometries: [
            { type: 'Point', coordinates: [0, 0] },
            { type: 'Point', coordinates: [1, 1] },
          ],
        })
      )
    })

    it('should return null for an empty collection', () => {
      assert.isNull(
        GeoUtils.mergeGeometryCollection({ type: 'GeometryCollection', geometries: [] })
      )
    })
  })
})
