describe('U.FeatureMixin', function () {
  let map, datalayer
  before(async () => {
    await fetchMock.mock(
      /\/datalayer\/62\/\?.*/,
      JSON.stringify(RESPONSES.datalayer62_GET)
    )
    this.options = {
      umap_id: 99,
    }
    MAP = map = initMap({ umap_id: 99 })
    const datalayer_options = defaultDatalayerData()
    await map.initDataLayers([datalayer_options])
    datalayer = map.getDataLayerByUmapId(62)
  })
  after(function () {
    fetchMock.restore()
    resetMap()
  })

  describe('#utils()', function () {
    var poly, marker
    function setFeatures(datalayer) {
      datalayer.eachLayer(function (layer) {
        if (!poly && layer instanceof L.Polygon) {
          poly = layer
        }
        if (!marker && layer instanceof L.Marker) {
          marker = layer
        }
      })
    }
    it('should generate a valid geojson', function () {
      setFeatures(datalayer)
      assert.ok(poly)
      assert.deepEqual(poly.toGeoJSON().geometry, {
        type: 'Polygon',
        coordinates: [
          [
            [11.25, 53.585984],
            [10.151367, 52.975108],
            [12.689209, 52.167194],
            [14.084473, 53.199452],
            [12.634277, 53.618579],
            [11.25, 53.585984],
            [11.25, 53.585984],
          ],
        ],
      })
      // Ensure original latlngs has not been modified
      assert.equal(poly.getLatLngs()[0].length, 6)
    })

    it('should remove empty _umap_options from exported geojson', function () {
      setFeatures(datalayer)
      assert.ok(poly)
      assert.deepEqual(poly.toGeoJSON().properties, { name: 'name poly' })
      assert.ok(marker)
      assert.deepEqual(marker.toGeoJSON().properties, {
        _umap_options: { color: 'OliveDrab' },
        name: 'test',
      })
    })
  })

  describe('#properties()', function () {
    it('should rename property', function () {
      var poly = datalayer._lineToLayer({}, [
        [0, 0],
        [0, 1],
        [0, 2],
      ])
      poly.properties.prop1 = 'xxx'
      poly.renameProperty('prop1', 'prop2')
      assert.equal(poly.properties.prop2, 'xxx')
      assert.ok(typeof poly.properties.prop1 === 'undefined')
    })

    it('should not create property when renaming', function () {
      var poly = datalayer._lineToLayer({}, [
        [0, 0],
        [0, 1],
        [0, 2],
      ])
      delete poly.properties.prop2 // Make sure it doesn't exist
      poly.renameProperty('prop1', 'prop2')
      assert.ok(typeof poly.properties.prop2 === 'undefined')
    })

    it('should delete property', function () {
      var poly = datalayer._lineToLayer({}, [
        [0, 0],
        [0, 1],
        [0, 2],
      ])
      poly.properties.prop = 'xxx'
      assert.equal(poly.properties.prop, 'xxx')
      poly.deleteProperty('prop')
      assert.ok(typeof poly.properties.prop === 'undefined')
    })
  })

  describe('#matchFilter()', function () {
    var poly

    it('should filter on properties', function () {
      poly = datalayer._lineToLayer({}, [
        [0, 0],
        [0, 1],
        [0, 2],
      ])
      poly.properties.name = 'mooring'
      assert.ok(poly.matchFilter('moo', ['name']))
      assert.notOk(poly.matchFilter('foo', ['name']))
    })

    it('should be case unsensitive', function () {
      assert.ok(poly.matchFilter('Moo', ['name']))
    })

    it('should match also in the middle of a string', function () {
      assert.ok(poly.matchFilter('oor', ['name']))
    })

    it('should handle multiproperties', function () {
      poly.properties.city = 'Teulada'
      assert.ok(poly.matchFilter('eul', ['name', 'city', 'foo']))
    })
  })

})
