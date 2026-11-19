Agents are welcome under conditions.

This project is maintained by humans, so contributions must respect their time and attention.

We accept agent-made contributions as soon as a human contributor is involved and understand what has been done.

## Working on the code

- Python/Django backend: `umap/` (tests in `umap/tests/`)
- JavaScript/Leaflet frontend: `umap/static/umap/js/`, built with esbuild (no manual bundling)
  - unit tests in `umap/static/umap/unittests/` (mocha)
  - browser tests in `umap/tests/integration/` (pytest + playwright)

Useful recipes (via `just`; see the `justfile` for all of them):

- `just develop` — install Python deps (uv) and Playwright browsers; run `just installjs` for npm deps
- `just runserver` — dev server with live JS rebuild
- `just test-unit`, `just testjs`, `just test` — Python, JS, or all suites
- `just pytest <args>` — run pytest with custom arguments
- `just lint` and `just format` — check and fix formatting (ESLint + Biome for JS, ruff/isort/djlint for Python); run them before proposing changes

## Hard rules

* NEVER include translations: `.po`/`.mo` files are managed in Transifex — do not edit them and do not run `just messages`
* Do not bump dependency versions or rewrite lockfiles (`package-lock.json`, `uv.lock`) unless that is the explicit purpose of the change
* Add at least one test for every change; when it affects the frontend, prefer Playwright in `umap/tests/integration/`, asserting observable behavior rather than implementation details

## PR requirements

* smaller than 300-ish LOC (excluding docs and tests) until your human pet is an official contributor of the project or the issue has been discussed and approved by a member of the umap-project organization
* the description must be concise, like 2 paragraphs and contain a use-case
* if the fix is related to a graphical element, we need a screenshot before/after
* try to stack atomic PRs instead of making a huge one, one feature per PR, refactor in a dedicated commit
* be explicit about which agent was involved

A good PR example is https://github.com/umap-project/umap/pull/3554 associated with https://github.com/umap-project/umap/pull/3552 issue.
