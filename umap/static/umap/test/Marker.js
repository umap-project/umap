describe('U.Marker', () => {
  let map, datalayer
  before(async () => {
    const datalayer_response = JSON.parse(JSON.stringify(RESPONSES.datalayer62_GET)) // Copy.
    datalayer_response._umap_options.iconClass = 'Drop'
    await fetchMock.mock(/\/datalayer\/62\/\?.*/, datalayer_response)
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

  describe('#iconClassChange()', () => {
    it('should change icon class', () => {
      enableEdit()
      happen.click(qs('div.umap-drop-icon'))
      happen.click(qs('ul.leaflet-inplace-toolbar a.umap-toggle-edit'))
      changeSelectValue(
        qs(
          'form#umap-feature-shape-properties .umap-field-iconClass select[name=iconClass]'
        ),
        'Circle'
      )
      assert.notOk(qs('div.umap-drop-icon'))
      assert.ok(qs('div.umap-circle-icon'))
      happen.click(
        qs('form#umap-feature-shape-properties .umap-field-iconClass .undefine')
      )
      assert.notOk(qs('div.umap-circle-icon'))
      assert.ok(qs('div.umap-drop-icon'))
      clickCancel()
    })
  })

  describe('#iconSymbolChange()', () => {
    it('should change icon symbol', () => {
      enableEdit()
      happen.click(qs('div.umap-drop-icon'))
      happen.click(qs('ul.leaflet-inplace-toolbar a.umap-toggle-edit'))
      changeInputValue(
        qs(
          'form#umap-feature-shape-properties .umap-field-iconUrl input[name=iconUrl]'
        ),
        '1'
      )
      assert.equal(qs('div.umap-drop-icon span').textContent, '1')
      changeInputValue(
        qs(
          'form#umap-feature-shape-properties .umap-field-iconUrl input[name=iconUrl]'
        ),
        '{name}'
      )
      assert.equal(qs('div.umap-drop-icon span').textContent, 'test')
      clickCancel()
    })
  })

  describe('#iconClassChange()', () => {
    it('should change icon class', () => {
      enableEdit()
      happen.click(qs('div.umap-drop-icon'))
      happen.click(qs('ul.leaflet-inplace-toolbar a.umap-toggle-edit'))
      changeSelectValue(
        qs(
          'form#umap-feature-shape-properties .umap-field-iconClass select[name=iconClass]'
        ),
        'Circle'
      )
      assert.notOk(qs('div.umap-drop-icon'))
      assert.ok(qs('div.umap-circle-icon'))
      happen.click(
        qs('form#umap-feature-shape-properties .umap-field-iconClass .undefine')
      )
      assert.notOk(qs('div.umap-circle-icon'))
      assert.ok(qs('div.umap-drop-icon'))
      clickCancel()
    })
  })

  describe('#clone', () => {
    it('should clone marker', () => {
      var layer = new U.Marker(map, [10, 20], {
        datalayer: datalayer,
      }).addTo(datalayer)
      assert.equal(datalayer._index.length, 4)
      other = layer.clone()
      assert.ok(map.hasLayer(other))
      assert.equal(datalayer._index.length, 5)
      // Must not be the same reference
      assert.notEqual(layer._latlng, other._latlng)
      assert.equal(L.Util.formatNum(layer._latlng.lat), other._latlng.lat)
      assert.equal(L.Util.formatNum(layer._latlng.lng), other._latlng.lng)
    })
  })

  describe('#edit()', function (done) {
    it('should allow changing coordinates manually', () => {
      var layer = new U.Marker(map, [10, 20], {
        datalayer: datalayer,
      }).addTo(datalayer)
      enableEdit()
      layer.edit()
      changeInputValue(qs('form.umap-form input[name="lat"]'), '54.43')
      assert.equal(layer._latlng.lat, 54.43)
    })

    it('should not allow invalid latitude nor longitude', () => {
      var layer = new U.Marker(map, [10, 20], {
        datalayer: datalayer,
      }).addTo(datalayer)
      enableEdit()
      layer.edit()
      changeInputValue(qs('form.umap-form input[name="lat"]'), '5443')
      assert.equal(layer._latlng.lat, 10)
      changeInputValue(qs('form.umap-form input[name="lng"]'), '5443')
      assert.equal(layer._latlng.lng, 20)
    })
  })
})
