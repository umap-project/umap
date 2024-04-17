describe('U.Polygon', function () {
  var p2ll, map, datalayer

  before(function () {
    map = initMap({ umap_id: 99 })
    enableEdit()
    p2ll = function (x, y) {
      return map.containerPointToLatLng([x, y])
    }
    datalayer = map.createDataLayer()
    datalayer.connectToMap()
  })

  after(function () {
    clickCancel()
    resetMap()
  })

  afterEach(function () {
    datalayer.empty()
  })

  describe('#isMulti()', function () {
    it('should return false for basic Polygon', function () {
      var layer = new U.Polygon(
        map,
        [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        { datalayer: datalayer }
      )
      assert.notOk(layer.isMulti())
    })

    it('should return false for nested basic Polygon', function () {
      var latlngs = [[[p2ll(100, 150), p2ll(150, 200), p2ll(200, 100)]]],
        layer = new U.Polygon(map, latlngs, { datalayer: datalayer })
      assert.notOk(layer.isMulti())
    })

    it('should return false for simple Polygon with hole', function () {
      var layer = new U.Polygon(
        map,
        [
          [
            [1, 2],
            [3, 4],
            [5, 6],
          ],
          [
            [7, 8],
            [9, 10],
            [11, 12],
          ],
        ],
        { datalayer: datalayer }
      )
      assert.notOk(layer.isMulti())
    })

    it('should return true for multi Polygon', function () {
      var latLngs = [
        [
          [
            [1, 2],
            [3, 4],
            [5, 6],
          ],
        ],
        [
          [
            [7, 8],
            [9, 10],
            [11, 12],
          ],
        ],
      ]
      var layer = new U.Polygon(map, latLngs, { datalayer: datalayer })
      assert.ok(layer.isMulti())
    })

    it('should return true for multi Polygon with hole', function () {
      var latLngs = [
        [
          [
            [10, 20],
            [30, 40],
            [50, 60],
          ],
        ],
        [
          [
            [0, 10],
            [10, 10],
            [10, 0],
          ],
          [
            [2, 3],
            [2, 4],
            [3, 4],
          ],
        ],
      ]
      var layer = new U.Polygon(map, latLngs, { datalayer: datalayer })
      assert.ok(layer.isMulti())
    })
  })

})
