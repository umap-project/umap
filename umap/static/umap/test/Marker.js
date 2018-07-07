describe('L.U.Marker', function () {

    before(function () {
        this.server = sinon.fakeServer.create();
        var datalayer_response = JSON.parse(JSON.stringify(RESPONSES.datalayer62_GET));  // Copy.
        datalayer_response._umap_options.iconClass = 'Drop';
        this.server.respondWith('GET', '/datalayer/62/', JSON.stringify(datalayer_response));
        this.map = initMap({umap_id: 99});
        this.datalayer = this.map.getDataLayerByUmapId(62);
        this.server.respond();
    });
    after(function () {
        this.server.restore();
        resetMap();
    });

    describe('#iconClassChange()', function () {

        it('should change icon class', function () {
            enableEdit();
            happen.click(qs('div.umap-drop-icon'));
            happen.click(qs('ul.leaflet-inplace-toolbar a.umap-toggle-edit'));
            changeSelectValue(qs('form#umap-feature-shape-properties .umap-field-iconClass select[name=iconClass]'), 'Circle');
            assert.notOk(qs('div.umap-drop-icon'));
            assert.ok(qs('div.umap-circle-icon'));
            happen.click(qs('form#umap-feature-shape-properties .umap-field-iconClass .undefine'));
            assert.notOk(qs('div.umap-circle-icon'));
            assert.ok(qs('div.umap-drop-icon'));
            clickCancel();
        });

    });

    describe('#iconSymbolChange()', function () {

        it('should change icon symbol', function () {
            enableEdit();
            happen.click(qs('div.umap-drop-icon'));
            happen.click(qs('ul.leaflet-inplace-toolbar a.umap-toggle-edit'));
            changeInputValue(qs('form#umap-feature-shape-properties .umap-field-iconUrl input[name=iconUrl]'), '1');
            assert.equal(qs('div.umap-drop-icon span').textContent, '1');
            changeInputValue(qs('form#umap-feature-shape-properties .umap-field-iconUrl input[name=iconUrl]'), '{name}');
            assert.equal(qs('div.umap-drop-icon span').textContent, 'test');
            clickCancel();
        });

    });

    describe('#iconClassChange()', function () {

        it('should change icon class', function () {
            enableEdit();
            happen.click(qs('div.umap-drop-icon'));
            happen.click(qs('ul.leaflet-inplace-toolbar a.umap-toggle-edit'));
            changeSelectValue(qs('form#umap-feature-shape-properties .umap-field-iconClass select[name=iconClass]'), 'Circle');
            assert.notOk(qs('div.umap-drop-icon'));
            assert.ok(qs('div.umap-circle-icon'));
            happen.click(qs('form#umap-feature-shape-properties .umap-field-iconClass .undefine'));
            assert.notOk(qs('div.umap-circle-icon'));
            assert.ok(qs('div.umap-drop-icon'));
            clickCancel();
        });

    });

    describe('#clone', function () {

        it('should clone marker', function () {
            var layer = new L.U.Marker(this.map, [10, 20], {datalayer: this.datalayer}).addTo(this.datalayer);
            assert.equal(this.datalayer._index.length, 4);
            other = layer.clone();
            assert.ok(this.map.hasLayer(other));
            assert.equal(this.datalayer._index.length, 5);
            // Must not be the same reference
            assert.notEqual(layer._latlng, other._latlng);
            assert.equal(L.Util.formatNum(layer._latlng.lat), other._latlng.lat);
            assert.equal(L.Util.formatNum(layer._latlng.lng), other._latlng.lng);
        });

    });

});
