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

  describe('#databrowser()', () => {
    let poly, marker, line
    before(() => {
      datalayer.eachLayer(function (layer) {
        if (!poly && layer instanceof L.Polygon) {
          poly = layer
        } else if (!line && layer instanceof L.Polyline) {
          line = layer
        } else if (!marker && layer instanceof L.Marker) {
          marker = layer
        }
      })
    })

    it('should be opened at datalayer button click', () => {
      var button = qs('.umap-browse-actions .umap-browse-link')
      assert.ok(button)
      happen.click(button)
      assert.ok(qs('#umap-ui-container .umap-browse-data'))
    })

    it('should contain datalayer section', () => {
      assert.ok(qs('#browse_data_datalayer_62'))
    })

    it("should contain datalayer's features list", () => {
      assert.equal(qsa('#browse_data_datalayer_62 ul li').length, 3)
    })

    it('should sort feature in natural order', () => {
      poly.properties.name = '9. a poly'
      marker.properties.name = '1. a marker'
      line.properties.name = '100. a line'
      datalayer.reindex()
      map.openBrowser()
      const els = qsa('.umap-browse-features li')
      assert.equal(els.length, 3)
      assert.equal(els[0].textContent, '1. a marker')
      assert.equal(els[1].textContent, '9. a poly')
      assert.equal(els[2].textContent, '100. a line')
    })

    it("should redraw datalayer's features list at feature delete", () => {
      var oldConfirm = window.confirm
      window.confirm = () => {
        return true
      }
      enableEdit()
      happen.once(qs('path[fill="DarkBlue"]'), { type: 'contextmenu' })
      happen.click(qs('.leaflet-contextmenu .umap-delete'))
      assert.equal(qsa('#browse_data_datalayer_62 ul li').length, 2)
      window.confirm = oldConfirm
    })

    it("should redraw datalayer's features list on edit cancel", () => {
      clickCancel()
      happen.click(qs('.umap-browse-actions .umap-browse-link'))
      assert.equal(qsa('#browse_data_datalayer_62 ul li').length, 3)
    })
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
