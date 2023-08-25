describe('L.U.Map.initialize', function () {
  afterEach(function () {
    resetMap()
  })

  describe('Controls', function () {
    it('should not show a minimap by default', function () {
      this.map = initMap()
      assert.notOk(qs('.leaflet-control-minimap'))
    })

    it('should show a minimap', function () {
      this.map = initMap({ miniMap: true })
      assert.ok(qs('.leaflet-control-minimap'))
    })
  })

  describe('DefaultView', function () {
    it('should set default view in default mode without data', function (done) {
      this.map = initMap({ datalayers: [] })
      // Did not find a better way to wait for tiles to be actually loaded
      window.setTimeout(() => {
        assert.ok(qs('#map .leaflet-tile-pane img.leaflet-tile.leaflet-tile-loaded'))
        done()
      }, 1000)
    })

    it("should set default view in 'data' mode without data", function (done) {
      this.map = initMap({ datalayers: [], defaultView: 'data' })
      // Did not find a better way to wait for tiles to be actually loaded
      window.setTimeout(() => {
        assert.ok(qs('#map .leaflet-tile-pane img.leaflet-tile.leaflet-tile-loaded'))
        done()
      }, 1000)
    })

    it("should set default view in 'latest' mode without data", function (done) {
      this.map = initMap({ datalayers: [], defaultView: 'latest' })
      // Did not find a better way to wait for tiles to be actually loaded
      window.setTimeout(() => {
        assert.ok(qs('#map .leaflet-tile-pane img.leaflet-tile.leaflet-tile-loaded'))
        done()
      }, 1000)
    })
  })
})
