.DEFAULT_GOAL := help

.PHONY: install
install: ## Install the dependencies
	python3 -m pip install --upgrade pip
	python3 -m pip install -e .

.PHONY: develop
develop: ## Install the test and dev dependencies
	python3 -m pip install -e .[test,dev,sync,s3]
	playwright install

.PHONY: format
format: ## Format the code and templates files
	-djlint umap/templates --reformat
	-isort --profile black umap/
	-ruff format --target-version=py310 umap/

.PHONY: lint
lint: ## Lint the code and template files
	npx eslint umap/static/umap/js/
	djlint umap/templates --lint
	isort --check --profile black umap/
	ruff format --check --target-version=py310 umap/
	vermin --no-tips --violations -t=3.10- umap/

docs: ## Compile the docs
	mkdocs build

.PHONY: version
version: ## Display the current version
	@hatch version

.PHONY: patch
patch: ## Bump the current version to a new patch one
	@hatch version fix

.PHONY: minor
minor: ## Bump the current version to a new minor one
	@hatch version minor

.PHONY: docker
docker: ## Create a new Docker image and publish it
	$(eval VERSION=$(shell hatch version))
	@echo "Version to build: ${VERSION}"
	docker build -t umap/umap:${VERSION} .
	docker push umap/umap:${VERSION}

.PHONY: helm
helm: ## Build the helm chart and publish it
	$(eval VERSION=$(shell hatch version))
	$(eval PACKAGE=$(shell helm package --dependency-update --app-version ${VERSION} ./charts/umap | grep "Successfully packaged" | awk '{print $$NF}'))
	@echo "Successfully packaged helm chart in: ${PACKAGE}"
	helm push ${PACKAGE} oci://registry-1.docker.io/umap

.PHONY: build
build: ## Build the Python package before release
	@hatch build --clean

.PHONY: publish
publish: ## Publish the Python package to Pypi
	@hatch publish
	make clean

test: testpy testjs

testpy:
	pytest -vv umap/tests/ --dist=loadgroup --reruns 1 --maxfail 10

test-integration:
	pytest -xv umap/tests/integration/ --dist=loadgroup

clean:
	rm -f dist/*
	rm -rf build/*
compilemessages:
	umap compilemessages
	umap generate_js_locale
messages:
	cd umap && umap makemessages -l en
	node node_modules/leaflet-i18n/bin/i18n.js --dir_path=umap/static/umap/js/ --dir_path=umap/static/umap/vendors/measurable/ --locale_dir_path=umap/static/umap/locale/ --locale_codes=en --mode=json --clean --default_values --expressions=_,translate
vendors:
	npm run vendors
installjs:
	npm install
testjs: node_modules
	node_modules/mocha/bin/mocha.js umap/static/umap/unittests/
tx_push:
	tx push -s
tx_pull:
	tx pull
changelog:
	$(eval VERSION=$(shell hatch version))
	@# Bearer token is readonly
	@printf $(shell curl -sL -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" https://api.github.com/repos/umap-project/umap/releases/generate-notes  -d '{"target_commitish":"master","previous_tag_name":"", "tag_name": "${VERSION}"}' | jq .body | sed 's/https:\/\/github.com\/umap-project\/umap\/pull\//#/g' | sed 's/`/\\`/g')

jsdir = umap/static/umap/js/
filepath = "${jsdir}*.js"
.PHONY: pretty
pretty: ## Apply Biome to all JS files (or specified `jsdir`)
	./node_modules/@biomejs/biome/bin/biome check --write ${jsdir}

.PHONY: lebab
lebab: ## Convert JS `filepath` to modern syntax with Lebab, then prettify
	./node_modules/lebab/bin/index.js --replace ${filepath} --transform arrow,arrow-return
	./node_modules/lebab/bin/index.js --replace ${filepath} --transform let
	./node_modules/lebab/bin/index.js --replace ${filepath} --transform template
	$(MAKE) pretty filepath=${filepath}

.PHONY: lebab-all
lebab-all: $(jsdir)* ## Convert all JS files to modern syntax with Lebab + prettify
	for file in $^ ; do $(MAKE) lebab filepath=$${file}; done


icons:
	scour -i umap/static/umap/img/source/24.svg -o umap/static/umap/img/24.svg --strip-xml-prolog --enable-comment-stripping
	scour -i umap/static/umap/img/source/24-white.svg -o umap/static/umap/img/24-white.svg --strip-xml-prolog --enable-comment-stripping
	scour -i umap/static/umap/img/source/16.svg -o umap/static/umap/img/16.svg --strip-xml-prolog --enable-comment-stripping
	scour -i umap/static/umap/img/source/16-white.svg -o umap/static/umap/img/16-white.svg --strip-xml-prolog --enable-comment-stripping


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
