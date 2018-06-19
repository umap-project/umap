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

});
