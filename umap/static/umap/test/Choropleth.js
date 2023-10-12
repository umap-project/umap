const POLYGONS = {
  _umap_options: defaultDatalayerData(),
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'number 1',
        value: 45,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 49],
            [-2, 47],
            [1, 46],
            [3, 47],
            [0, 49],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'number 2',
        value: 87,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 49],
            [2, 50],
            [6, 49],
            [4, 47],
            [0, 49],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'number 3',
        value: 673,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [4, 47],
            [6, 49],
            [11, 47],
            [9, 45],
            [4, 47],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'number 4',
        value: 674,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [2, 46],
            [4, 47],
            [8, 45],
            [6, 43],
            [2, 46],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'number 5',
        value: 839,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-2, 47],
            [1, 46],
            [0, 44],
            [-4, 45],
            [-2, 47],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'number 6',
        value: 3829,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [1, 45],
            [5, 43],
            [4, 42],
            [0, 44],
            [1, 45],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'number 7',
        value: 4900,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [9, 45],
            [12, 47],
            [15, 45],
            [13, 43],
            [9, 45],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'number 8',
        value: 4988,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [7, 43],
            [9, 45],
            [12, 43],
            [10, 42],
            [7, 43],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'number 9',
        value: 9898,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [4, 42],
            [6, 43],
            [9, 41],
            [7, 40],
            [4, 42],
          ],
        ],
      },
    },
  ],
}

describe('L.U.Choropleth', function () {
  let path = '/map/99/datalayer/edit/62/',
    poly1,
    poly4,
    poly9

  before(function () {
    this.server = sinon.fakeServer.create()
    this.server.respondWith(/\/datalayer\/62\/\?.*/, JSON.stringify(POLYGONS))
    this.map = initMap({ umap_id: 99 })
    this.datalayer = this.map.getDataLayerByUmapId(62)
    this.server.respond()
    this.datalayer.options.type = 'Choropleth'
    this.datalayer.options.choropleth = {
      property: 'value',
    }
    enableEdit()
    this.datalayer.eachLayer(function (layer) {
      if (layer.properties.name === 'number 1') {
        poly1 = layer
      } else if (layer.properties.name === 'number 4') {
        poly4 = layer
      } else if (layer.properties.name === 'number 9') {
        poly9 = layer
      }
    })
  })
  after(function () {
    this.server.restore()
    //resetMap()
  })

  describe('#init()', function () {
    it('datalayer should have 9 features', function () {
      assert.equal(this.datalayer._index.length, 9)
    })
  })
  describe('#compute()', function () {
    it('choropleth should compute default colors', function () {
      this.datalayer.resetLayer(true)
      assert.deepEqual(
        this.datalayer.layer.options.breaks,
        [45, 673, 3829, 4900, 9898, 9898]
      )
      assert.equal(poly1._path.attributes.fill.value, '#eff3ff')
      assert.equal(poly4._path.attributes.fill.value, '#bdd7e7')
      assert.equal(poly9._path.attributes.fill.value, '#3182bd')
    })
    it('can change brewer scheme', function () {
      this.datalayer.options.choropleth.brewer = 'Reds'
      this.datalayer.resetLayer(true)
      assert.equal(poly1._path.attributes.fill.value, '#fee5d9')
      assert.equal(poly4._path.attributes.fill.value, '#fcae91')
      assert.equal(poly9._path.attributes.fill.value, '#de2d26')
    })
    it('choropleth should allow to change steps', function () {
      this.datalayer.options.choropleth.brewer = 'Blues'
      this.datalayer.options.choropleth.classes = 6
      this.datalayer.resetLayer(true)
      assert.equal(poly1._path.attributes.fill.value, '#eff3ff')
      assert.equal(poly4._path.attributes.fill.value, '#c6dbef')
      assert.equal(poly9._path.attributes.fill.value, '#3182bd')
    })
  })
})
