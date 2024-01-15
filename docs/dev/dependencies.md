# Packaging

The packaging is handled by the `pyproject.toml` file for python dependencies,
and by `package.json` for JavaScript dependencies.

## Python

Python dependencies are pinned, and we're relying on Github's dependabot to
update them for us, via pull requests.

## JavaScript

Dependencies are **not** pinned, but a `^` character is used instead ([defined
by node semver](https://github.com/npm/node-semver#caret-ranges-123-025-004)),
meaning the next minor or patch versions will be installed (but not the next major)

The installed libs needs to be:

- Added to the `package.json`
- Added in the `scripts/vendorsjs.sh` script
- Loaded in the HTML templates.

