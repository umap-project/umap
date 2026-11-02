jsdir := "umap/static/umap/js/"

[private]
default:
    @just --list --unsorted

# Install the dependencies
install:
    uv sync --extra dev,test,sync,s3

# Install the test and dev dependencies
develop: install
    uv run playwright install

# Install the test and dev dependencies for ci
ci: install
    uv run playwright install chromium-headless-shell

# Run the dev server (DEBUG=1 unless DEBUG is set) and rebuild the JS on change
runserver address="0.0.0.0:8020":
    #!/usr/bin/env bash
    set -euo pipefail
    export DEBUG="${DEBUG-1}"
    npm run build:watch &
    watch_pid=$!
    # Ctrl-C reaches the watcher too, so it may already be gone.
    trap 'kill $watch_pid 2>/dev/null || true' EXIT
    uv run umap runserver {{ address }}

# Format the code and templates files
format:
    -uv run djlint umap/templates --reformat
    -uv run isort --profile black umap/
    -uv run ruff format --target-version=py310 umap/

# Lint the code and template files
lint:
    npx eslint umap/static/umap/js/
    uv run djlint umap/templates --lint
    uv run isort --check --profile black umap/
    uv run ruff format --check --target-version=py310 umap/
    # vermin fails strangely, let's skip it for a while
    # hopping that this will get fixed upstream
    #vermin --no-tips --violations -t=3.10- umap/

# Compile the docs
docs:
    uv run mkdocs build

# Display the current version
version:
    @uv run hatch version

# Bump the current version to a new patch one
patch:
    @uv run hatch version fix

# Bump the current version to a new minor one
minor:
    @uv run hatch version minor

# Create a new Docker image and publish it
docker:
    #!/usr/bin/env bash
    set -euo pipefail
    VERSION=$(uv run hatch version)
    echo "Version to build: ${VERSION}"
    # You must run `docker buildx create --use` first or check with `docker buildx ls`
    docker buildx build --platform linux/amd64,linux/arm64 -t umap/umap:${VERSION} --push .

# Build the helm chart and publish it
helm:
    #!/usr/bin/env bash
    set -euo pipefail
    VERSION=$(hatch version)
    PACKAGE=$(helm package --dependency-update --app-version ${VERSION} ./charts/umap | grep "Successfully packaged" | awk '{print $NF}')
    echo "Successfully packaged helm chart in: ${PACKAGE}"
    helm push ${PACKAGE} oci://registry-1.docker.io/umap

# Rebuild the javascript assets on change
watch:
    npm run build:watch

# Build the javascript assets
buildjs:
    npm run build:prod

# Build the Python package before release
buildpy:
    @uv run hatch build --clean

# Build the package (JS + Python)
build: buildjs buildpy

# Publish the Python package to Pypi
publish: && clean
    @uv run hatch publish

# Run all the test suites (Python unit, integration, JS)
test: test-unit test-integration testjs

# Run pytest with any pytest argument (e.g. just pytest umap/tests/test_views.py -k share)
[positional-arguments]
pytest *args:
    uv run pytest "$@"

test-unit:
    uv run pytest -vv umap/tests/ --ignore=umap/tests/integration

test-integration:
    uv run pytest -vv umap/tests/integration/ --dist=loadgroup --reruns 1 --maxfail 3

testjs:
    node_modules/mocha/bin/mocha.js umap/static/umap/unittests/

# Remove generated screenshot artifacts, keeping the expected baselines
clean-screenshots:
    rm -f umap/tests/screenshots/*.actual.png umap/tests/screenshots/*.diff.png

clean:
    rm -f dist/*
    rm -rf build/*

compilemessages:
    uv run umap compilemessages
    uv run umap generate_js_locale

messages:
    cd umap && uv run umap makemessages -l en
    node scripts/i18n.js

installjs:
    npm install

tx_push:
    tx push -s
    @printf "\nTo translate, open https://app.transifex.com/openstreetmap/umap/translate/#fr/frontend?q=translated%%3Ano\n"

tx_pull:
    tx pull

changelog:
    #!/usr/bin/env bash
    set -euo pipefail
    VERSION=$(uv run hatch version)
    # Bearer token is readonly
    curl -sL -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" https://api.github.com/repos/umap-project/umap/releases/generate-notes -d "{\"target_commitish\":\"master\",\"previous_tag_name\":\"\", \"tag_name\": \"${VERSION}\"}" | jq -r .body | sed 's/https:\/\/github.com\/umap-project\/umap\/pull\//#/g'

# Apply Biome to all JS files (or to the given dir)
pretty dir=jsdir:
    ./node_modules/@biomejs/biome/bin/biome check --write {{ dir }}

# Convert JS `filepath` to modern syntax with Lebab, then prettify
lebab filepath=(jsdir + "*.js"):
    ./node_modules/lebab/bin/index.js --replace {{ filepath }} --transform arrow,arrow-return
    ./node_modules/lebab/bin/index.js --replace {{ filepath }} --transform let
    ./node_modules/lebab/bin/index.js --replace {{ filepath }} --transform template
    just pretty

# Convert all JS files to modern syntax with Lebab + prettify
lebab-all:
    for file in {{ jsdir }}*; do just lebab "$file"; done

icons:
    scour -i umap/static/umap/img/source/24.svg -o umap/static/umap/img/24.svg --strip-xml-prolog --enable-comment-stripping
    scour -i umap/static/umap/img/source/24-white.svg -o umap/static/umap/img/24-white.svg --strip-xml-prolog --enable-comment-stripping
    scour -i umap/static/umap/img/source/16.svg -o umap/static/umap/img/16.svg --strip-xml-prolog --enable-comment-stripping
    scour -i umap/static/umap/img/source/16-white.svg -o umap/static/umap/img/16-white.svg --strip-xml-prolog --enable-comment-stripping
