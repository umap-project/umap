test:
	py.test -xv umap/tests/
develop:
	pip install -e .[test,dev]
release: test compilemessages
	python setup.py sdist bdist_wheel
test_publish:
	twine upload -r testpypi dist/*
publish:
	twine upload dist/*
	make clean
clean:
	rm -f dist/*
	rm -rf build/*
compilemessages:
	umap compilemessages
	umap generate_js_locale
messages:
	umap makemessages -l en --ignore node_modules --ignore umap_project.egg-info --ignore __pycache__ --ignore umap/tests
	node node_modules/leaflet-i18n/bin/i18n.js --dir_path=umap/static/umap/js/ --dir_path=umap/static/umap/vendors/measurable/ --locale_dir_path=umap/static/umap/locale/ --locale_codes=en --mode=json --clean --default_values
vendors:
	mkdir -p umap/static/umap/vendors/leaflet/ && cp -r node_modules/leaflet/dist/** umap/static/umap/vendors/leaflet/
	mkdir -p umap/static/umap/vendors/editable/ && cp -r node_modules/leaflet-editable/src/*.js umap/static/umap/vendors/editable/
	mkdir -p umap/static/umap/vendors/editable/ && cp -r node_modules/leaflet.path.drag/src/*.js umap/static/umap/vendors/editable/
	mkdir -p umap/static/umap/vendors/hash/ && cp -r node_modules/leaflet-hash/*.js umap/static/umap/vendors/hash/
	mkdir -p umap/static/umap/vendors/i18n/ && cp -r node_modules/leaflet-i18n/*.js umap/static/umap/vendors/i18n/
	mkdir -p umap/static/umap/vendors/editinosm/ && cp -r node_modules/leaflet-editinosm/Leaflet.EditInOSM.* umap/static/umap/vendors/editinosm/
	mkdir -p umap/static/umap/vendors/minimap/ && cp -r node_modules/leaflet-minimap/src/** umap/static/umap/vendors/minimap/
	mkdir -p umap/static/umap/vendors/loading/ && cp -r node_modules/leaflet-loading/src/** umap/static/umap/vendors/loading/
	mkdir -p umap/static/umap/vendors/markercluster/ && cp -r node_modules/leaflet.markercluster/dist/** umap/static/umap/vendors/markercluster/
	mkdir -p umap/static/umap/vendors/contextmenu/ && cp -r node_modules/leaflet-contextmenu/dist/** umap/static/umap/vendors/contextmenu/
	mkdir -p umap/static/umap/vendors/heat/ && cp -r node_modules/leaflet.heat/dist/** umap/static/umap/vendors/heat/
	mkdir -p umap/static/umap/vendors/fullscreen/ && cp -r node_modules/leaflet-fullscreen/dist/** umap/static/umap/vendors/fullscreen/
	mkdir -p umap/static/umap/vendors/toolbar/ && cp -r node_modules/leaflet-toolbar/dist/** umap/static/umap/vendors/toolbar/
	mkdir -p umap/static/umap/vendors/formbuilder/ && cp -r node_modules/leaflet-formbuilder/*.js umap/static/umap/vendors/formbuilder/
	mkdir -p umap/static/umap/vendors/measurable/ && cp -r node_modules/leaflet-measurable/Leaflet.Measurable.* umap/static/umap/vendors/measurable/
	mkdir -p umap/static/umap/vendors/photon/ && cp -r node_modules/leaflet.photon/*.js umap/static/umap/vendors/photon/
	mkdir -p umap/static/umap/vendors/csv2geojson/ && cp -r node_modules/csv2geojson/*.js umap/static/umap/vendors/csv2geojson/
	mkdir -p umap/static/umap/vendors/togeojson/ && cp -r node_modules/togeojson/*.js umap/static/umap/vendors/togeojson/
	mkdir -p umap/static/umap/vendors/osmtogeojson/ && cp -r node_modules/osmtogeojson/osmtogeojson.js umap/static/umap/vendors/osmtogeojson/
	mkdir -p umap/static/umap/vendors/georsstogeojson/ && cp -r node_modules/georsstogeojson/GeoRSSToGeoJSON.js umap/static/umap/vendors/georsstogeojson/
	mkdir -p umap/static/umap/vendors/togpx/ && cp -r node_modules/togpx/togpx.js umap/static/umap/vendors/togpx/
	mkdir -p umap/static/umap/vendors/tokml && cp -r node_modules/tokml/tokml.js umap/static/umap/vendors/tokml
	mkdir -p umap/static/umap/vendors/locatecontrol/ && cp -r node_modules/leaflet.locatecontrol/{dist/L.Control.Locate.css,src/L.Control.Locate.js} umap/static/umap/vendors/locatecontrol/
installjs:
	npm install
testjsfx:
	firefox umap/static/umap/test/index.html
testjs: node_modules
	@./node_modules/mocha-phantomjs/bin/mocha-phantomjs --view 1024x768 umap/static/umap/test/index.html
tx_push:
	tx push -s
tx_pull:
	tx pull

jsdir = umap/static/umap/js/
filepath = "${jsdir}*.js"
pretty: ## Apply PrettierJS to all JS files (or specified `filepath`)
	./node_modules/prettier/bin-prettier.js --write ${filepath}

lebab: ## Convert JS `filepath` to modern syntax with Lebab, then prettify
	./node_modules/lebab/bin/index.js --replace ${filepath} --transform arrow,arrow-return
	$(MAKE) pretty filepath=${filepath}

lebab-all: $(jsdir)* ## Convert all JS files to modern syntax with Lebab + prettify
	for file in $^ ; do $(MAKE) lebab filepath=$${file}; done
