describe('U.DataLayer', () => {
  let path = '/map/99/datalayer/update/62/',
    map,
    datalayer

  before(async () => {
    fetchMock.mock(/\/datalayer\/62\/\?.*/, JSON.stringify(RESPONSES.datalayer62_GET))
    fetchMock.sticky('/map/99/update/settings/', { id: 99 })
    this.options = {
      umap_id: 99,
    }
    MAP = map = initMap({ umap_id: 99 })
    const datalayer_options = defaultDatalayerData()
    await map.initDataLayers([datalayer_options])
    datalayer = map.getDataLayerByUmapId(62)
    enableEdit()
  })
  after(() => {
    fetchMock.restore()
    resetMap()
  })

  describe('#init()', () => {
    it('should be added in datalayers index', () => {
      assert.notEqual(map.datalayers_index.indexOf(datalayer), -1)
    })
  })

  describe('#edit()', () => {
    var editButton, form, input, forceButton

    it('row in control should be active', () => {
      assert.notOk(
        qs('.leaflet-control-browse #browse_data_toggle_' + L.stamp(datalayer) + '.off')
      )
    })

    it('should have edit button', () => {
      editButton = qs('#browse_data_toggle_' + L.stamp(datalayer) + ' .layer-edit')
      assert.ok(editButton)
    })

    it('should have toggle visibility element', () => {
      assert.ok(qs('.leaflet-control-browse i.layer-toggle'))
    })

    it('should exist only one datalayer', () => {
      assert.equal(qsa('.leaflet-control-browse i.layer-toggle').length, 1)
    })

    it('should build a form on edit button click', () => {
      happen.click(editButton)
      form = qs('form.umap-form')
      input = qs('form.umap-form input[name="name"]')
      assert.ok(form)
      assert.ok(input)
    })

    it('should update name on input change', () => {
      var new_name = 'This is a new name'
      input.value = new_name
      happen.once(input, { type: 'input' })
      assert.equal(datalayer.options.name, new_name)
    })

    it('should have made datalayer dirty', () => {
      assert.ok(datalayer.isDirty)
      assert.notEqual(map.dirty_datalayers.indexOf(datalayer), -1)
    })

    it('should have made Map dirty', () => {
      assert.ok(map.isDirty)
    })

    it('should call datalayer.save on save button click', (done) => {
      const postDatalayer = fetchMock.post(path, () => {
        return defaultDatalayerData()
      })
      clickSave()
      window.setTimeout(() => {
        assert(fetchMock.called(path))
        done()
      }, 500)
    })

    it('should show alert if server respond 412', (done) => {
      cleanAlert()
      fetchMock.restore()
      fetchMock.post(path, 412)
      happen.click(editButton)
      input = qs('form.umap-form input[name="name"]')
      input.value = 'a new name'
      happen.once(input, { type: 'input' })
      clickSave()
      window.setTimeout(() => {
        assert(L.DomUtil.hasClass(map._container, 'umap-alert'))
        assert.notEqual(map.dirty_datalayers.indexOf(datalayer), -1)
        const forceButton = qs('#umap-alert-container .umap-action')
        assert.ok(forceButton)
        done()
      }, 500)
    })

    it('should save anyway on force save button click', (done) => {
      const forceButton = qs('#umap-alert-container .umap-action')
      fetchMock.restore()
      fetchMock.post(path, defaultDatalayerData)
      happen.click(forceButton)
      window.setTimeout(() => {
        assert.notOk(qs('#umap-alert-container .umap-action'))
        assert(fetchMock.called(path))
        assert.equal(map.dirty_datalayers.indexOf(datalayer), -1)
        done()
      }, 500)
    })
  })

  describe('#save() new', () => {
    let newLayerButton, form, input, newDatalayer, editButton, manageButton

    it('should have a manage datalayers action', () => {
      enableEdit()
      manageButton = qs('.manage-datalayers')
      assert.ok(manageButton)
      happen.click(manageButton)
    })

    it('should have a new layer button', () => {
      newLayerButton = qs('.panel.right.on .add-datalayer')
      assert.ok(newLayerButton)
    })

    it('should build a form on new layer button click', () => {
      happen.click(newLayerButton)
      form = qs('form.umap-form')
      input = qs('form.umap-form input[name="name"]')
      assert.ok(form)
      assert.ok(input)
    })

    it('should have an empty name', () => {
      assert.notOk(input.value)
    })

    it('should have created a new datalayer', () => {
      assert.equal(map.datalayers_index.length, 2)
      newDatalayer = map.datalayers_index[1]
    })

    it('should have made Map dirty', () => {
      assert.ok(map.isDirty)
    })

    it('should update name on input change', () => {
      var new_name = 'This is a new name'
      input.value = new_name
      happen.once(input, { type: 'input' })
      assert.equal(newDatalayer.options.name, new_name)
    })

    it('should set umap_id on save callback', async () => {
      assert.notOk(newDatalayer.umap_id)
      fetchMock.post('/map/99/datalayer/create/', defaultDatalayerData({ id: 63 }))
      clickSave()
      return new Promise((resolve) => {
        window.setTimeout(() => {
          assert.equal(newDatalayer.umap_id, 63)
          resolve()
        }, 1000)
      })
    })

    it('should have unset map dirty', () => {
      assert.notOk(map.isDirty)
    })

    it('should have edit button', () => {
      editButton = qs('#browse_data_toggle_' + L.stamp(newDatalayer) + ' .layer-edit')
      assert.ok(editButton)
    })

    it('should call update if we edit again', async () => {
      happen.click(editButton)
      assert.notOk(map.isDirty)
      input = qs('form.umap-form input[name="name"]')
      input.value = "a new name again but we don't care which"
      happen.once(input, { type: 'input' })
      assert.ok(map.isDirty)
      var response = () => {
        return defaultDatalayerData({ pk: 63 })
      }
      var spy = sinon.spy(response)
      fetchMock.post('/map/99/datalayer/update/63/', spy)
      return new Promise((resolve) => {
        clickSave()
        window.setTimeout(() => {
          assert.ok(spy.calledOnce)
          resolve()
        }, 1000)
      })
    })
  })

  describe('#iconClassChange()', () => {
    it('should change icon class', () => {
      happen.click(qs('[data-id="' + datalayer._leaflet_id + '"] .layer-edit'))
      changeSelectValue(
        qs('form#datalayer-advanced-properties select[name=iconClass]'),
        'Circle'
      )
      assert.notOk(qs('div.umap-div-icon'))
      assert.ok(qs('div.umap-circle-icon'))
      happen.click(
        qs('form#datalayer-advanced-properties .umap-field-iconClass .undefine')
      )
      assert.notOk(qs('div.umap-circle-icon'))
      assert.ok(qs('div.umap-div-icon'))
      clickCancel()
    })
  })

  describe('#show/hide', () => {
    it('should hide features on hide', () => {
      assert.ok(qs('div.umap-div-icon'))
      assert.ok(qs('path[fill="none"]'))
      datalayer.hide()
      assert.notOk(qs('div.umap-div-icon'))
      assert.notOk(qs('path[fill="none"]'))
    })

    it('should show features on show', () => {
      assert.notOk(qs('div.umap-div-icon'))
      assert.notOk(qs('path[fill="none"]'))
      datalayer.show()
      assert.ok(qs('div.umap-div-icon'))
      assert.ok(qs('path[fill="none"]'))
    })
  })

  describe('#clone()', () => {
    it('should clone everything but the id and the name', () => {
      enableEdit()
      var clone = datalayer.clone()
      assert.notOk(clone.umap_id)
      assert.notEqual(clone.options.name, datalayer.name)
      assert.ok(clone.options.name)
      assert.equal(clone.options.color, datalayer.options.color)
      assert.equal(clone.options.stroke, datalayer.options.stroke)
      clone._delete()
      clickSave()
    })
  })

  describe('#restore()', () => {
    var oldConfirm,
      newConfirm = () => {
        return true
      }

    before(() => {
      oldConfirm = window.confirm
      window.confirm = newConfirm
    })
    after(() => {
      window.confirm = oldConfirm
    })

    it('should restore everything', (done) => {
      enableEdit()
      var geojson = L.Util.CopyJSON(RESPONSES.datalayer62_GET)
      geojson.features.push({
        geometry: {
          type: 'Point',
          coordinates: [-1.274658203125, 50.57634993749885],
        },
        type: 'Feature',
        id: 1807,
        properties: { _umap_options: {}, name: 'new point from restore' },
      })
      geojson._umap_options.color = 'Chocolate'
      fetchMock.get('/datalayer/62/olderversion.geojson', geojson)
      sinon.spy(window, 'confirm')
      datalayer.restore('olderversion.geojson')
      window.setTimeout(() => {
        assert(window.confirm.calledOnce)
        window.confirm.restore()
        assert.equal(datalayer.umap_id, 62)
        assert.ok(datalayer.isDirty)
        assert.equal(datalayer._index.length, 4)
        assert.ok(qs('path[fill="Chocolate"]'))
        done()
      }, 1000)
    })

    it('should revert anything on cancel click', () => {
      clickCancel()
      assert.equal(datalayer._index.length, 3)
      assert.notOk(qs('path[fill="Chocolate"]'))
    })
  })

  describe('#smart-options()', () => {
    let poly, marker
    before(() => {
      datalayer.eachLayer(function (layer) {
        if (!poly && layer instanceof L.Polygon) {
          poly = layer
        }
        if (!marker && layer instanceof L.Marker) {
          marker = layer
        }
      })
    })

    it('should parse color variable', () => {
      let icon = qs('div.umap-div-icon .icon_container')
      poly.properties.mycolor = 'DarkGoldenRod'
      marker.properties.mycolor = 'DarkRed'
      marker.properties._umap_options.color = undefined
      assert.notOk(qs('path[fill="DarkGoldenRod"]'))
      assert.equal(icon.style.backgroundColor, 'olivedrab')
      datalayer.options.color = '{mycolor}'
      datalayer.options.fillColor = '{mycolor}'
      datalayer.indexProperties(poly)
      datalayer.indexProperties(marker)
      datalayer.redraw()
      icon = qs('div.umap-div-icon .icon_container')
      assert.equal(icon.style.backgroundColor, 'darkred')
      assert.ok(qs('path[fill="DarkGoldenRod"]'))
    })
  })

  describe('#facet-search()', () => {
    before(async () => {
      fetchMock.get(/\/datalayer\/63\/\?.*/, RESPONSES.datalayer63_GET)
      map.options.facetKey = 'name'
      await map.initDataLayers([RESPONSES.datalayer63_GET._umap_options])
    })
    it('should not impact non browsable layer', () => {
      assert.ok(qs('path[fill="SteelBlue"]'))
    })
    it('should allow advanced filter', () => {
      map.openFacet()
      assert.ok(qs('div.umap-facet-search'))
      // This one if from the normal datalayer
      // it's name is "test", so it should be hidden
      // by the filter
      assert.ok(qs('path[fill="none"]'))
      happen.click(qs('input[data-value="name poly"]'))
      assert.notOk(qs('path[fill="none"]'))
      // This one comes from a non browsable layer
      // so it should not be affected by the filter
      assert.ok(qs('path[fill="SteelBlue"]'))
      happen.click(qs('input[data-value="name poly"]')) // Undo
    })
    it('should allow to control facet label', () => {
      map.options.facetKey = 'name|Nom'
      map.openFacet()
      assert.ok(qs('div.umap-facet-search h5'))
      assert.equal(qs('div.umap-facet-search h5').textContent, 'Nom')
    })
  })
  describe('#zoomEnd', () => {
    it('should honour the fromZoom option', () => {
      map.setZoom(6, { animate: false })
      assert.ok(qs('path[fill="none"]'))
      datalayer.options.fromZoom = 6
      map.setZoom(5, { animate: false })
      assert.notOk(qs('path[fill="none"]'))
      map.setZoom(6, { animate: false })
      assert.ok(qs('path[fill="none"]'))
    })

    it('should honour the toZoom option', () => {
      map.setZoom(6, { animate: false })
      assert.ok(qs('path[fill="none"]'))
      datalayer.options.toZoom = 6
      map.setZoom(7, { animate: false })
      assert.notOk(qs('path[fill="none"]'))
      map.setZoom(6, { animate: false })
      assert.ok(qs('path[fill="none"]'))
    })
  })

  describe('#displayOnLoad', () => {
    before(() => {
      fetchMock.get(/\/datalayer\/64\/\?.*/, RESPONSES.datalayer64_GET)
    })

    beforeEach(async () => {
      await map.initDataLayers([RESPONSES.datalayer64_GET._umap_options])
      datalayer = map.getDataLayerByUmapId(64)
      map.setZoom(10, { animate: false })
    })

    afterEach(() => {
      datalayer._delete()
    })

    it('should not display layer at load', () => {
      assert.notOk(qs('path[fill="AliceBlue"]'))
    })

    it('should display on click', (done) => {
      happen.click(qs(`[data-id='${L.stamp(datalayer)}'] .layer-toggle`))
      window.setTimeout(() => {
        assert.ok(qs('path[fill="AliceBlue"]'))
        done()
      }, 500)
    })

    it('should not display on zoom', (done) => {
      map.setZoom(9, { animate: false })
      window.setTimeout(() => {
        assert.notOk(qs('path[fill="AliceBlue"]'))
        done()
      }, 500)
    })
  })

  describe('#delete()', () => {
    let deleteLink,
      deletePath = '/map/99/datalayer/delete/62/'
    before(() => {
      datalayer = map.getDataLayerByUmapId(62)
    })

    it('should have a delete link in update form', () => {
      enableEdit()
      happen.click(qs('#browse_data_toggle_' + L.stamp(datalayer) + ' .layer-edit'))
      deleteLink = qs('button.delete_datalayer_button')
      assert.ok(deleteLink)
    })

    it('should delete features on datalayer delete', () => {
      happen.click(deleteLink)
      assert.notOk(qs('div.icon_container'))
    })

    it('should have set map dirty', () => {
      assert.ok(map.isDirty)
    })

    it('should delete layer control row on delete', () => {
      assert.notOk(
        qs('.leaflet-control-browse #browse_data_toggle_' + L.stamp(datalayer))
      )
    })

    it('should be removed from map.datalayers_index', () => {
      assert.equal(map.datalayers_index.indexOf(datalayer), -1)
    })

    it('should be removed from map.datalayers', () => {
      assert.notOk(map.datalayers[L.stamp(datalayer)])
    })

    it('should be visible again on edit cancel', () => {
      clickCancel()
      assert.ok(qs('div.icon_container'))
    })
  })
})
