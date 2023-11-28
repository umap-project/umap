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

## Merging rules

Pull requests 

## Update translations

Install needed tools:

    apt install gettext transifex-client

Pull the translations from transifex website:

    tx pull -f

Then you will need to update binary files with command:

    make compilemessages

Done. You can now review and commit modified/added files.
