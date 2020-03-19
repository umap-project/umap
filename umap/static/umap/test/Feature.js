describe('L.U.FeatureMixin', function () {

    before(function () {
        this.server = sinon.fakeServer.create();
        this.server.respondWith('GET', '/datalayer/62/', JSON.stringify(RESPONSES.datalayer62_GET));
        this.map = initMap({umap_id: 99});
        this.datalayer = this.map.getDataLayerByUmapId(62);
        this.server.respond();
    });
    after(function () {
        this.server.restore();
        resetMap();
    });

    describe('#edit()', function () {
        var link;

        it('should have datalayer features created', function () {
            assert.equal(document.querySelectorAll('#map > .leaflet-map-pane > .leaflet-overlay-pane path.leaflet-interactive').length, 2);
            assert.ok(qs('path[fill="none"]')); // Polyline
            assert.ok(qs('path[fill="DarkBlue"]')); // Polygon
        });

        it('should take into account styles changes made in the datalayer', function () {
            enableEdit();
            happen.click(qs('#browse_data_toggle_' + L.stamp(this.datalayer) + ' .layer-edit'));
            var colorInput = qs('form#datalayer-advanced-properties input[name=color]');
            changeInputValue(colorInput, 'DarkRed');
            assert.ok(qs('path[fill="none"]')); // Polyline fill is unchanged
            assert.notOk(qs('path[fill="DarkBlue"]'));
            assert.ok(qs('path[fill="DarkRed"]'));
        });

        it('should open a popup toolbar on feature click', function () {
            enableEdit();
            happen.click(qs('path[fill="DarkRed"]'));
            var toolbar = qs('ul.leaflet-inplace-toolbar');
            assert.ok(toolbar);
            link = qs('a.umap-toggle-edit', toolbar);
            assert.ok(link);
        });

        it('should open a form on popup toolbar toggle edit click', function () {
            happen.click(link);
            var form = qs('form#umap-feature-properties');
            var input = qs('form#umap-feature-properties input[name="name"]');
            assert.ok(form);
            assert.ok(input);
        });

        it('should not handle _umap_options has normal property', function () {
            assert.notOk(qs('form#umap-feature-properties input[name="_umap_options"]'));
        });

        it('should give precedence to feature style over datalayer styles', function () {
            var input = qs('#umap-ui-container form input[name="color"]');
            assert.ok(input);
            changeInputValue(input, 'DarkGreen');
            assert.notOk(qs('path[fill="DarkRed"]'));
            assert.notOk(qs('path[fill="DarkBlue"]'));
            assert.ok(qs('path[fill="DarkGreen"]'));
            assert.ok(qs('path[fill="none"]')); // Polyline fill is unchanged
        });

        it('should remove stroke if set to no', function () {
            assert.notOk(qs('path[stroke="none"]'));
            var defineButton = qs('#umap-feature-shape-properties .formbox:nth-child(4) .define');
            happen.click(defineButton);
            var input = qs('#umap-feature-shape-properties input[name="stroke"]');
            assert.ok(input);
            input.checked = false;
            happen.once(input, {type: 'change'});
            assert.ok(qs('path[stroke="none"]'));
            assert.ok(qs('path[fill="none"]')); // Polyline fill is unchanged
        });

        it('should not override already set style on features', function () {
            happen.click(qs('#browse_data_toggle_' + L.stamp(this.datalayer) + ' .layer-edit'));
            changeInputValue(qs('#umap-ui-container form input[name=color]'), 'Chocolate');
            assert.notOk(qs('path[fill="DarkBlue"]'));
            assert.notOk(qs('path[fill="DarkRed"]'));
            assert.notOk(qs('path[fill="Chocolate"]'));
            assert.ok(qs('path[fill="DarkGreen"]'));
            assert.ok(qs('path[fill="none"]')); // Polyline fill is unchanged
        });

        it('should reset style on cancel click', function () {
            clickCancel();
            assert.ok(qs('path[fill="none"]')); // Polyline fill is unchanged
            assert.ok(qs('path[fill="DarkBlue"]'));
            assert.notOk(qs('path[fill="DarkRed"]'));
        });

        it('should set map.editedFeature on edit', function () {
            enableEdit();
            assert.notOk(this.map.editedFeature);
            happen.click(qs('path[fill="DarkBlue"]'));
            happen.click(qs('ul.leaflet-inplace-toolbar a.umap-toggle-edit'));
            assert.ok(this.map.editedFeature);
            disableEdit();
        });

        it('should reset map.editedFeature on panel open', function (done) {
            enableEdit();
            assert.notOk(this.map.editedFeature);
            happen.click(qs('path[fill="DarkBlue"]'));
            happen.click(qs('ul.leaflet-inplace-toolbar a.umap-toggle-edit'));
            assert.ok(this.map.editedFeature);
            this.map.displayCaption();
            window.setTimeout(function () {
                assert.notOk(this.map.editedFeature);
                disableEdit();
                done();
            }, 1001);  // CSS transition time.
        });

    });

    describe('#utils()', function () {
        var poly, marker;
        function setFeatures (datalayer) {
            datalayer.eachLayer(function (layer) {
                if (!poly && layer instanceof L.Polygon) {
                    poly = layer;
                }
                if (!marker && layer instanceof L.Marker) {
                    marker = layer;
                }
            });
        }
        it('should generate a valid geojson', function () {
            setFeatures(this.datalayer);
            assert.ok(poly);
            assert.deepEqual(poly.toGeoJSON().geometry, {'type': 'Polygon', 'coordinates': [[[11.25, 53.585984], [10.151367, 52.975108], [12.689209, 52.167194], [14.084473, 53.199452], [12.634277, 53.618579], [11.25, 53.585984], [11.25, 53.585984]]]});
            // Ensure original latlngs has not been modified
            assert.equal(poly.getLatLngs()[0].length, 6);
        });

        it('should remove empty _umap_options from exported geojson', function () {
            setFeatures(this.datalayer);
            assert.ok(poly);
            assert.deepEqual(poly.toGeoJSON().properties, {name: 'name poly'});
            assert.ok(marker);
            assert.deepEqual(marker.toGeoJSON().properties, {_umap_options: {color: 'OliveDrab'}, name: 'test'});
        });

    });

    describe('#changeDataLayer()', function () {

        it('should change style on datalayer select change', function () {
            enableEdit();
            happen.click(qs('.manage-datalayers'));
            happen.click(qs('#umap-ui-container .add-datalayer'));
            changeInputValue(qs('form.umap-form input[name="name"]'), 'New layer');
            changeInputValue(qs('form#datalayer-advanced-properties input[name=color]'), 'MediumAquaMarine');
            happen.click(qs('path[fill="DarkBlue"]'));
            happen.click(qs('ul.leaflet-inplace-toolbar a.umap-toggle-edit'));
            var select = qs('select[name=datalayer]');
            select.selectedIndex = 0;
            happen.once(select, {type: 'change'});
            assert.ok(qs('path[fill="none"]')); // Polyline fill is unchanged
            assert.notOk(qs('path[fill="DarkBlue"]'));
            assert.ok(qs('path[fill="MediumAquaMarine"]'));
            clickCancel();
        });

    });

    describe('#openPopup()', function () {

        it('should open a popup on click', function () {
            assert.notOk(qs('.leaflet-popup-content'));
            happen.click(qs('path[fill="DarkBlue"]'));
            var title = qs('.leaflet-popup-content');
            assert.ok(title);
            assert.ok(title.innerHTML.indexOf('name poly'));
        });

    });

    describe('#tooltip', function () {

        it('should have a tooltip when active and allow variables', function () {
            this.map.options.showLabel = true;
            this.map.options.labelKey = "Foo {name}";
            this.datalayer.redraw();
            assert.equal(qs('.leaflet-tooltip-pane .leaflet-tooltip').textContent, "Foo name poly");
        });

    });

    describe('#properties()', function () {

        it('should rename property', function () {
            var poly = this.datalayer._lineToLayer({}, [[0, 0], [0, 1], [0, 2]]);
            poly.properties.prop1 = 'xxx';
            poly.renameProperty('prop1', 'prop2');
            assert.equal(poly.properties.prop2, 'xxx');
            assert.ok(typeof poly.properties.prop1 === 'undefined');
        });

        it('should not create property when renaming', function () {
            var poly = this.datalayer._lineToLayer({}, [[0, 0], [0, 1], [0, 2]]);
            delete poly.properties.prop2;  // Make sure it doesn't exist
            poly.renameProperty('prop1', 'prop2');
            assert.ok(typeof poly.properties.prop2 === 'undefined');
        });

        it('should delete property', function () {
            var poly = this.datalayer._lineToLayer({}, [[0, 0], [0, 1], [0, 2]]);
            poly.properties.prop = 'xxx';
            assert.equal(poly.properties.prop, 'xxx');
            poly.deleteProperty('prop');
            assert.ok(typeof poly.properties.prop === 'undefined');
        });

    });

    describe('#matchFilter()', function () {
        var poly;

        it('should filter on properties', function () {
            poly = this.datalayer._lineToLayer({}, [[0, 0], [0, 1], [0, 2]]);
            poly.properties.name = 'mooring';
            assert.ok(poly.matchFilter('moo', ['name']));
            assert.notOk(poly.matchFilter('foo', ['name']));
        });

        it('should be case unsensitive', function () {
            assert.ok(poly.matchFilter('Moo', ['name']));
        });

        it('should match also in the middle of a string', function () {
            assert.ok(poly.matchFilter('oor', ['name']));
        });

        it('should handle multiproperties', function () {
            poly.properties.city = 'Teulada';
            assert.ok(poly.matchFilter('eul', ['name', 'city', 'foo']));
        });

    });

});
