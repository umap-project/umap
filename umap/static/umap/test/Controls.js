describe('L.U.Controls', () => {
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
  after(() => {
    fetchMock.restore()
    resetMap()
  })

  describe('#exportPanel()', () => {
    it('should be opened at datalayer button click', () => {
      let button = qs('.leaflet-control-embed button')
      assert.ok(button)
      happen.click(button)
      assert.ok(qs('#umap-ui-container .umap-share'))
    })
    it('should update iframe link', () => {
      let textarea = qs('.umap-share-iframe')
      assert.ok(textarea)
      console.log(textarea.textContent)
      assert.include(textarea.textContent, 'src="')
      assert.include(textarea.textContent, 'href="')
      // We should ave both, once for iframe link, once for full screen
      assert.include(textarea.textContent, 'scrollWheelZoom=true')
      assert.include(textarea.textContent, 'scrollWheelZoom=false')
      assert.notInclude(textarea.textContent, 'datalayers=62')
      let switcher = qs('label[title="Keep current visible layers"]')
      happen.click(switcher)
      assert.include(textarea.textContent, 'datalayers=62')
    })
  })
})
