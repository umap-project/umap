describe('L.TableEditor', () => {
  let path = '/map/99/datalayer/edit/62/',
    datalayer

  before(async  () => {
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
    enableEdit()
  })
  after(() => {
    fetchMock.restore()
    clickCancel()
    resetMap()
  })

  describe('#open()', () => {
    var button

    it('should exist table click on edit mode', () => {
      button = qs(
        '#browse_data_toggle_' + L.stamp(datalayer) + ' .icon-table'
      )
      expect(button).to.be.ok
    })

    it('should open table button click', () => {
      happen.click(button)
      expect(qs('.panel.full.on div.table')).to.be.ok
      expect(qsa('.panel.full.on div.table form').length).to.eql(3) // One per feature.
      expect(qsa('.panel.full.on div.table input').length).to.eql(3) // One per feature and per property.
    })
  })
  describe('#properties()', () => {
    var feature

    before(() => {
      var firstIndex = datalayer._index[0]
      feature = datalayer._layers[firstIndex]
    })

    it('should create new property column', () => {
      var newPrompt = () => {
        return 'newprop'
      }
      var oldPrompt = window.prompt
      window.prompt = newPrompt
      var button = qs('.panel.full.on .add-property')
      expect(button).to.be.ok
      happen.click(button)
      expect(qsa('.panel.full.on div.table input').length).to.eql(6) // One per feature and per property.
      window.prompt = oldPrompt
    })

    it('should populate feature property on fill', () => {
      var input = qs(
        'form#umap-feature-properties_' + L.stamp(feature) + ' input[name=newprop]'
      )
      changeInputValue(input, 'the value')
      expect(feature.properties.newprop).to.eql('the value')
    })

    it('should update property name on update click', () => {
      var newPrompt = () => {
        return 'newname'
      }
      var oldPrompt = window.prompt
      window.prompt = newPrompt
      var button = qs('.panel.full.on div.thead div.tcell:last-of-type .umap-edit')
      expect(button).to.be.ok
      happen.click(button)
      expect(qsa('.panel.full.on div.table input').length).to.eql(6)
      expect(feature.properties.newprop).to.be.undefined
      expect(feature.properties.newname).to.eql('the value')
      window.prompt = oldPrompt
    })

    it('should update property on delete click', () => {
      var oldConfirm,
        newConfirm = () => {
          return true
        }
      oldConfirm = window.confirm
      window.confirm = newConfirm
      var button = qs(
        '.panel.full.on div.thead div.tcell:last-of-type .umap-delete'
      )
      expect(button).to.be.ok
      happen.click(button)
      FEATURE = feature
      expect(qsa('.panel.full.on div.table input').length).to.eql(3)
      expect(feature.properties.newname).to.be.undefined
      window.confirm = oldConfirm
    })
  })
})
