# Contributing

So you want to contribute to uMap? Great news 🙌

We've put together this document so you have a brief overview of how things work.
You can help on different areas: translation, bug triage, documentation and development.

## Translating

uMap is translated to more than 50 languages! The translation is managed through [Transifex](https://www.transifex.com/openstreetmap/umap/). You will need an account to get started, and then you'll be able to translate easily.

## Bug Triage

You are very welcome to help us triage [uMap issues](https://github.com/umap-project/umap/issues). Don't hesitate to help other users by answering questions, give your point of view in discussions and just report bugs!

## Reporting a bug

If you've encountered a bug, don't hesitate to tell us about it. The best way to do this is by [opening a ticket on the bug tracker](https://github.com/umap-project/umap/issues/new/choose). But please, first, [have a look around](https://github.com/umap-project/umap/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc) to see if other users already reported something 😅

## Hacking on the code

Following the [installation instructions](install.md) should get you started to hack on the code.

### Installing dev dependencies

To be sure to install all the dev dependencies, and have everything working locally.

```bash
make develop
```

### Hack!

You can now do your changes in a specific branch, and when you're ready you can open a pull-request for us to review.

### Run tests

Multiple tests suites are in use in the project.

| Test suite             | Location                  | Command                 |
| ----------             | --------                  | -------                 |
| Python unit tests      | `umap/tests/integration`  | `pytest . --ignore umap/tests/integration` |
| Javascript unit tests  | `umap/static/test`        | `make testjs`|
| Integration tests      | `umap/tests/integration`  | `pytest umap/tests/integration` |

All the tests are run when you're creating a pull request, to avoid regressions.

### Merging rules

Pull requests need to be accepted by one maintainer of the project. Please be patient, we try to do our best, but it sometimes takes time.

## Update the translations

Install needed tools:

    apt install gettext transifex-client

Pull the translations from transifex website:

    tx pull -f

Then you will need to update binary files with command:

    make compilemessages

Done. You can now review and commit modified/added files.
