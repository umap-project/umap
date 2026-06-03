import { describe, it } from 'mocha'
import pkg from 'chai'
import * as GeoUtils from '../js/modules/geoutils.js'
const { assert } = pkg

describe('GeoUtils', () => {
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
})
