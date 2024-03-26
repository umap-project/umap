describe('U.Polyline', function () {
  var p2ll, map

  before(function () {
    this.map = map = initMap({ umap_id: 99 })
    enableEdit()
    p2ll = function (x, y) {
      return map.containerPointToLatLng([x, y])
    }
    this.datalayer = this.map.createDataLayer()
    this.datalayer.connectToMap()
  })

  after(function () {
    clickCancel()
    resetMap()
  })

  afterEach(function () {
    this.datalayer.empty()
  })

  describe('#isMulti()', function () {
    it('should return false for basic Polyline', function () {
      var layer = new U.Polyline(
        this.map,
        [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        { datalayer: this.datalayer }
      )
      assert.notOk(layer.isMulti())
    })

    it('should return false for nested basic Polyline', function () {
      var layer = new U.Polyline(
        this.map,
        [
          [
            [1, 2],
            [3, 4],
            [5, 6],
          ],
        ],
        { datalayer: this.datalayer }
      )
      assert.notOk(layer.isMulti())
    })

    it('should return true for multi Polyline', function () {
      var latLngs = [
        [
          [
            [1, 2],
            [3, 4],
            [5, 6],
          ],
        ],
        [
          [
            [7, 8],
            [9, 10],
            [11, 12],
          ],
        ],
      ]
      var layer = new U.Polyline(this.map, latLngs, { datalayer: this.datalayer })
      assert.ok(layer.isMulti())
    })
  })

  describe('#contextmenu', function () {
    afterEach(function () {
      // Make sure contextmenu is hidden.
      happen.once(document, { type: 'keydown', keyCode: 27 })
    })

    describe('#in edit mode', function () {
      it('should allow to remove shape when multi', function () {
        var latlngs = [
            [p2ll(100, 100), p2ll(100, 200)],
            [p2ll(300, 350), p2ll(350, 400), p2ll(400, 300)],
          ],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        happen.once(layer._path, { type: 'contextmenu' })
        assert.equal(qst('Remove shape from the multi'), 1)
      })

      it('should not allow to remove shape when not multi', function () {
        var latlngs = [[p2ll(100, 100), p2ll(100, 200)]],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        happen.once(layer._path, { type: 'contextmenu' })
        assert.notOk(qst('Remove shape from the multi'))
      })

      it('should not allow to isolate shape when not multi', function () {
        var latlngs = [[p2ll(100, 100), p2ll(100, 200)]],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        happen.once(layer._path, { type: 'contextmenu' })
        assert.notOk(qst('Extract shape to separate feature'))
      })

      it('should allow to isolate shape when multi', function () {
        var latlngs = [
            [p2ll(100, 150), p2ll(100, 200)],
            [p2ll(300, 350), p2ll(350, 400), p2ll(400, 300)],
          ],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        happen.once(layer._path, { type: 'contextmenu' })
        assert.ok(qst('Extract shape to separate feature'))
      })

      it('should not allow to transform to polygon when multi', function () {
        var latlngs = [
            [p2ll(100, 150), p2ll(100, 200)],
            [p2ll(300, 350), p2ll(350, 400), p2ll(400, 300)],
          ],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        happen.once(layer._path, { type: 'contextmenu' })
        assert.notOk(qst('Transform to polygon'))
      })

      it('should allow to transform to polygon when not multi', function () {
        var latlngs = [p2ll(100, 150), p2ll(100, 200), p2ll(200, 100)],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        happen.once(layer._path, { type: 'contextmenu' })
        assert.equal(qst('Transform to polygon'), 1)
      })

      it('should not allow to transfer shape when not editedFeature', function () {
        var layer = new U.Polyline(this.map, [p2ll(100, 150), p2ll(100, 200)], {
          datalayer: this.datalayer,
        }).addTo(this.datalayer)
        happen.once(layer._path, { type: 'contextmenu' })
        assert.notOk(qst('Transfer shape to edited feature'))
      })

      it('should not allow to transfer shape when editedFeature is not a line', function () {
        var layer = new U.Polyline(this.map, [p2ll(100, 150), p2ll(100, 200)], {
            datalayer: this.datalayer,
          }).addTo(this.datalayer),
          other = new U.Polygon(
            this.map,
            [p2ll(200, 300), p2ll(300, 200), p2ll(200, 100)],
            { datalayer: this.datalayer }
          ).addTo(this.datalayer)
        other.edit()
        happen.once(layer._path, { type: 'contextmenu' })
        assert.notOk(qst('Transfer shape to edited feature'))
      })

      it('should allow to transfer shape when another line is edited', function () {
        var layer = new U.Polyline(
            this.map,
            [p2ll(100, 150), p2ll(100, 200), p2ll(200, 100)],
            { datalayer: this.datalayer }
          ).addTo(this.datalayer),
          other = new U.Polyline(this.map, [p2ll(200, 300), p2ll(300, 200)], {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        other.edit()
        happen.once(layer._path, { type: 'contextmenu' })
        assert.equal(qst('Transfer shape to edited feature'), 1)
        other.remove()
        layer.remove()
      })

      it('should allow to merge lines when multi', function () {
        var latlngs = [
            [p2ll(100, 100), p2ll(100, 200)],
            [p2ll(300, 350), p2ll(350, 400), p2ll(400, 300)],
          ],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        happen.once(layer._path, { type: 'contextmenu' })
        assert.equal(qst('Merge lines'), 1)
      })

      it('should not allow to merge lines when not multi', function () {
        var latlngs = [[p2ll(100, 100), p2ll(100, 200)]],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        happen.once(layer._path, { type: 'contextmenu' })
        assert.notOk(qst('Merge lines'))
      })

      it('should allow to split lines when clicking on vertex', function () {
        var latlngs = [[p2ll(300, 350), p2ll(350, 400), p2ll(400, 300)]],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        layer.enableEdit()
        happen.at('contextmenu', 350, 400)
        assert.equal(qst('Split line'), 1)
      })

      it('should not allow to split lines when clicking on first vertex', function () {
        var latlngs = [[p2ll(300, 350), p2ll(350, 400), p2ll(400, 300)]],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        layer.enableEdit()
        happen.at('contextmenu', 300, 350)
        assert.equal(qst('Delete this feature'), 1) // Make sure we have clicked on the vertex.
        assert.notOk(qst('Split line'))
      })

      it('should not allow to split lines when clicking on last vertex', function () {
        var latlngs = [[p2ll(300, 350), p2ll(350, 400), p2ll(400, 300)]],
          layer = new U.Polyline(this.map, latlngs, {
            datalayer: this.datalayer,
          }).addTo(this.datalayer)
        layer.enableEdit()
        happen.at('contextmenu', 400, 300)
        assert.equal(qst('Delete this feature'), 1) // Make sure we have clicked on the vertex.
        assert.notOk(qst('Split line'))
      })
    })
  })

  describe('#mergeShapes', function () {
    it('should remove duplicated join point when merging', function () {
      var latlngs = [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [0, 1],
            [0, 2],
          ],
        ],
        layer = new U.Polyline(this.map, latlngs, {
          datalayer: this.datalayer,
        }).addTo(this.datalayer)
      layer.mergeShapes()
      layer.disableEdit() // Remove vertex from latlngs to compare them.
      assert.deepEqual(layer.getLatLngs(), [
        L.latLng([0, 0]),
        L.latLng([0, 1]),
        L.latLng([0, 2]),
      ])
      assert(this.map.isDirty)
    })

    it('should revert candidate if first point is closer', function () {
      var latlngs = [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [0, 2],
            [0, 1],
          ],
        ],
        layer = new U.Polyline(this.map, latlngs, {
          datalayer: this.datalayer,
        }).addTo(this.datalayer)
      layer.mergeShapes()
      layer.disableEdit()
      assert.deepEqual(layer.getLatLngs(), [
        L.latLng([0, 0]),
        L.latLng([0, 1]),
        L.latLng([0, 2]),
      ])
    })
  })

})
