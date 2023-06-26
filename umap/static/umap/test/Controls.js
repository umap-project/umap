describe('L.U.Controls', function () {
  before(function () {
    this.server = sinon.fakeServer.create()
    this.server.respondWith(
      /\/datalayer\/62\/\?.*/,
      JSON.stringify(RESPONSES.datalayer62_GET)
    )
    this.map = initMap({ umap_id: 99 })
    this.server.respond()
    this.datalayer = this.map.getDataLayerByUmapId(62)
  })
  after(function () {
    this.server.restore()
    resetMap()
  })

  describe('#databrowser()', function () {
    let poly, marker, line
    before(function () {
      this.datalayer.eachLayer(function (layer) {
        if (!poly && layer instanceof L.Polygon) {
          poly = layer
        } else if (!line && layer instanceof L.Polyline) {
          line = layer
        } else if (!marker && layer instanceof L.Marker) {
          marker = layer
        }
      })
    })

    it('should be opened at datalayer button click', function () {
      var button = qs('.umap-browse-actions .umap-browse-link')
      assert.ok(button)
      happen.click(button)
      assert.ok(qs('#umap-ui-container .umap-browse-data'))
    })

    it('should contain datalayer section', function () {
      assert.ok(qs('#browse_data_datalayer_62'))
    })

    it("should contain datalayer's features list", function () {
      assert.equal(qsa('#browse_data_datalayer_62 ul li').length, 3)
    })

    it('should sort feature in natural order', function () {
      poly.properties.name = '9. a poly'
      marker.properties.name = '1. a marker'
      line.properties.name = '100. a line'
      this.datalayer.reindex()
      this.map.openBrowser()
      const els = qsa('.umap-browse-features li')
      assert.equal(els.length, 3)
      assert.equal(els[0].textContent, '1. a marker')
      assert.equal(els[1].textContent, '9. a poly')
      assert.equal(els[2].textContent, '100. a line')
    })

    it("should redraw datalayer's features list at feature delete", function () {
      var oldConfirm = window.confirm
      window.confirm = function () {
        return true
      }
      enableEdit()
      happen.once(qs('path[fill="DarkBlue"]'), { type: 'contextmenu' })
      happen.click(qs('.leaflet-contextmenu .umap-delete'))
      assert.equal(qsa('#browse_data_datalayer_62 ul li').length, 2)
      window.confirm = oldConfirm
    })

    it("should redraw datalayer's features list on edit cancel", function () {
      clickCancel()
      happen.click(qs('.umap-browse-actions .umap-browse-link'))
      assert.equal(qsa('#browse_data_datalayer_62 ul li').length, 3)
    })

  })

  describe('#exportPanel()', function () {
    it('should be opened at datalayer button click', function () {
      let button = qs('.leaflet-control-embed a')
      assert.ok(button)
      happen.click(button)
      assert.ok(qs('#umap-ui-container .umap-share'))
    })
    it('should update iframe link', function () {
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
