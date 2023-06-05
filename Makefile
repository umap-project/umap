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
	cd umap && umap makemessages -l en
	node node_modules/leaflet-i18n/bin/i18n.js --dir_path=umap/static/umap/js/ --dir_path=umap/static/umap/vendors/measurable/ --locale_dir_path=umap/static/umap/locale/ --locale_codes=en --mode=json --clean --default_values
vendors:
	npm run vendors
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
	./node_modules/lebab/bin/index.js --replace ${filepath} --transform let
	./node_modules/lebab/bin/index.js --replace ${filepath} --transform template
	$(MAKE) pretty filepath=${filepath}

lebab-all: $(jsdir)* ## Convert all JS files to modern syntax with Lebab + prettify
	for file in $^ ; do $(MAKE) lebab filepath=$${file}; done
