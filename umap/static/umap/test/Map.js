describe('U.Map', () => {
  let map, datalayer
  before(async () => {
    await fetchMock.mock(
      /\/datalayer\/62\/\?.*/,
      JSON.stringify(RESPONSES.datalayer62_GET)
    )
    this.options = {
      umap_id: 99,
    }
    map = initMap({ umap_id: 99 })
    const datalayer_options = defaultDatalayerData()
    await map.initDataLayers([datalayer_options])
    datalayer = map.getDataLayerByUmapId(62)
  })
  after(() => {
    fetchMock.restore()
    clickCancel()
    resetMap()
  })

  describe('#localizeUrl()', function () {
    it('should replace known variables', function () {
      assert.equal(
        map.localizeUrl('http://example.org/{zoom}'),
        'http://example.org/' + map.getZoom()
      )
    })

    it('should keep unknown variables', function () {
      assert.equal(
        map.localizeUrl('http://example.org/{unkown}'),
        'http://example.org/{unkown}'
      )
    })
  })
})
