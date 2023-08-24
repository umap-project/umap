describe('L.U.Map.initialize', function () {
  afterEach(function () {
    resetMap()
  })

  it("should not show a minimap by default", function () {
    this.map = initMap()
    assert.notOk(qs('.leaflet-control-minimap'))
  })

  it("should show a minimap", function () {
    this.map = initMap({ miniMap: true })
    assert.ok(qs('.leaflet-control-minimap'))
  })

})
