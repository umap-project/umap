describe('L.U.Map.Export', function () {
  before(function () {
    this.server = sinon.fakeServer.create()
    this.server.respondWith(
      /\/datalayer\/62\/\?.*/,
      JSON.stringify(RESPONSES.datalayer62_GET)
    )
    this.options = {
      umap_id: 99,
    }
    this.map = initMap({ umap_id: 99 })
    this.server.respond()
    this.datalayer = this.map.getDataLayerByUmapId(62)
  })
  after(function () {
    this.server.restore()
    clickCancel()
    resetMap()
  })

  describe('#formatters()', function () {
    it('should export to geojson', function () {
      const { content, filetype, filename } = this.map.format('geojson')
      assert.equal(filetype, 'application/json')
      assert.equal(filename, 'name_of_the_map.geojson')
      assert.deepEqual(JSON.parse(content), {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              name: 'name poly',
            },
            geometry: {
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
            },
          },
          {
            type: 'Feature',
            properties: {
              _umap_options: {
                color: 'OliveDrab',
              },
              name: 'test',
            },
            geometry: {
              type: 'Point',
              coordinates: [-0.274658, 52.57635],
            },
          },
          {
            type: 'Feature',
            properties: {
              _umap_options: {
                fill: false,
              },
              name: 'test',
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [-0.571289, 54.476422],
                [0.439453, 54.610255],
                [1.724854, 53.448807],
                [4.163818, 53.988395],
                [5.306396, 53.533778],
                [6.591797, 53.709714],
                [7.042236, 53.350551],
              ],
            },
          },
        ],
      })
    })

    it('should export to gpx', function () {
      const { content, filetype, filename } = this.map.format('gpx')
      assert.equal(filetype, 'application/gpx+xml')
      assert.equal(filename, 'name_of_the_map.gpx')
      const expected =
        '<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="togpx"><metadata/><wpt lat="52.57635" lon="-0.274658"><name>test</name><desc>name=test</desc></wpt><trk><name>name poly</name><desc>name=name poly</desc><trkseg><trkpt lat="53.585984" lon="11.25"/><trkpt lat="52.975108" lon="10.151367"/><trkpt lat="52.167194" lon="12.689209"/><trkpt lat="53.199452" lon="14.084473"/><trkpt lat="53.618579" lon="12.634277"/><trkpt lat="53.585984" lon="11.25"/><trkpt lat="53.585984" lon="11.25"/></trkseg></trk><trk><name>test</name><desc>name=test</desc><trkseg><trkpt lat="54.476422" lon="-0.571289"/><trkpt lat="54.610255" lon="0.439453"/><trkpt lat="53.448807" lon="1.724854"/><trkpt lat="53.988395" lon="4.163818"/><trkpt lat="53.533778" lon="5.306396"/><trkpt lat="53.709714" lon="6.591797"/><trkpt lat="53.350551" lon="7.042236"/></trkseg></trk></gpx>'
      assert.equal(content, expected)
    })

    it('should export to gpx', function () {
      const { content, filetype, filename } = this.map.format('kml')
      assert.equal(filetype, 'application/vnd.google-earth.kml+xml')
      assert.equal(filename, 'name_of_the_map.kml')
      const expected =
        '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>name poly</name><ExtendedData><Data name="name"><value>name poly</value></Data></ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>11.25,53.585984 10.151367,52.975108 12.689209,52.167194 14.084473,53.199452 12.634277,53.618579 11.25,53.585984 11.25,53.585984</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark><Placemark><name>test</name><ExtendedData><Data name="_umap_options"><value>[object Object]</value></Data><Data name="name"><value>test</value></Data></ExtendedData><Point><coordinates>-0.274658,52.57635</coordinates></Point></Placemark><Placemark><name>test</name><ExtendedData><Data name="_umap_options"><value>[object Object]</value></Data><Data name="name"><value>test</value></Data></ExtendedData><LineString><coordinates>-0.571289,54.476422 0.439453,54.610255 1.724854,53.448807 4.163818,53.988395 5.306396,53.533778 6.591797,53.709714 7.042236,53.350551</coordinates></LineString></Placemark></Document></kml>'
      assert.equal(content, expected)
    })

    it('should export to umap', function () {
      const { content, filetype, filename } = this.map.format('umap')
      assert.equal(filetype, 'application/json')
      assert.equal(filename, 'name_of_the_map.umap')
      const expected = {
        type: 'umap',
        uri: null,
        properties: {
          easing: false,
          embedControl: true,
          fullscreenControl: true,
          searchControl: true,
          datalayersControl: true,
          zoomControl: true,
          permanentCreditBackground: true,
          slideshow: {},
          captionMenus: true,
          captionBar: false,
          limitBounds: {},
          overlay: null,
          tilelayer: {
            attribution: 'HOT and friends',
            name: 'HOT OSM-fr server',
            url_template: 'http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
            rank: 99,
            minZoom: 0,
            maxZoom: 20,
            id: 2,
          },
          licence: '',
          description: 'The description of the map',
          name: 'name of the map',
          displayPopupFooter: false,
          miniMap: false,
          moreControl: true,
          scaleControl: true,
          scrollWheelZoom: true,
          zoom: 6,
        },
        geometry: {
          type: 'Point',
          coordinates: [5.0592041015625, 52.05924589011585],
        },
        layers: [
          {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {
                  name: 'name poly',
                },
                geometry: {
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
                },
              },
              {
                type: 'Feature',
                properties: {
                  _umap_options: {
                    color: 'OliveDrab',
                  },
                  name: 'test',
                },
                geometry: {
                  type: 'Point',
                  coordinates: [-0.274658, 52.57635],
                },
              },
              {
                type: 'Feature',
                properties: {
                  _umap_options: {
                    fill: false,
                  },
                  name: 'test',
                },
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [-0.571289, 54.476422],
                    [0.439453, 54.610255],
                    [1.724854, 53.448807],
                    [4.163818, 53.988395],
                    [5.306396, 53.533778],
                    [6.591797, 53.709714],
                    [7.042236, 53.350551],
                  ],
                },
              },
            ],
            _umap_options: {
              displayOnLoad: true,
              browsable: true,
              editMode: 'advanced',
              iconClass: 'Default',
              name: 'Elephants',
              id: 62,
              pictogram_url: null,
              opacity: null,
              weight: null,
              fillColor: '',
              color: '',
              stroke: true,
              smoothFactor: null,
              dashArray: '',
              fillOpacity: null,
              fill: true,
            },
          },
        ],
      }
      assert.deepEqual(JSON.parse(content), expected)
    })
  })
})
