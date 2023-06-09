.DEFAULT_GOAL := help

.PHONY: install
install: ## Install the dependencies
	python3 -m pip install --upgrade pip
	python3 -m pip install -e .

.PHONY: develop
develop: ## Install the test and dev dependencies
	python3 -m pip install -e .[test,dev]

.PHONY: version
version: ## Display the current version
	@hatch version

.PHONY: bump
bump: ## Bump the current version to a new minor one
	@hatch version fix

.PHONY: docker
docker: ## Create a new Docker image and publish it
	$(eval VERSION=$(shell hatch version))
	@echo "Version to build: ${VERSION}"
	docker build -t umap/umap:${VERSION} .
	docker push umap/umap:${VERSION}


test:
	py.test -xv umap/tests/
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
.PHONY: pretty
pretty: ## Apply PrettierJS to all JS files (or specified `filepath`)
	./node_modules/prettier/bin-prettier.js --write ${filepath}

.PHONY: lebab
lebab: ## Convert JS `filepath` to modern syntax with Lebab, then prettify
	./node_modules/lebab/bin/index.js --replace ${filepath} --transform arrow,arrow-return
	./node_modules/lebab/bin/index.js --replace ${filepath} --transform let
	./node_modules/lebab/bin/index.js --replace ${filepath} --transform template
	$(MAKE) pretty filepath=${filepath}

.PHONY: lebab-all
lebab-all: $(jsdir)* ## Convert all JS files to modern syntax with Lebab + prettify
	for file in $^ ; do $(MAKE) lebab filepath=$${file}; done


.PHONY: help
help:
	@python -c "$$PRINT_HELP_PYSCRIPT" < $(MAKEFILE_LIST)

# See https://daniel.feldroy.com/posts/autodocumenting-makefiles
define PRINT_HELP_PYSCRIPT # start of Python section
import re, sys

output = []
# Loop through the lines in this file
for line in sys.stdin:
    # if the line has a command and a comment start with
    #   two pound signs, add it to the output
    match = re.match(r'^([a-zA-Z_-]+):.*?## (.*)$$', line)
    if match:
        target, help = match.groups()
        output.append("\033[36m%-20s\033[0m %s" % (target, help))
# Sort the output in alphanumeric order
output.sort()
# Print the help result
print('\n'.join(output))
endef
export PRINT_HELP_PYSCRIPT # End of python section
