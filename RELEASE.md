# How to make a release

1. I18N
    - `make messages` look for new strings within the code
    - `make tx_push` to publish new strings [to transifex](https://app.transifex.com/openstreetmap/umap/dashboard/)
    - translators at work
    - `make tx_pull` to retrieve new translations from transifex
    - `make compilemessages` to create regular `.mo` + `umap/static/umap/locale/*.js`
    - commit new translations `git commit -am "i18n"`
2. Bump version: `make patch|minor`
3. `git commit -am "1.X.Y"`
4. `git tag 1.X.Y`
5. `git push && git push --tag`
6. Go to [Github release page](https://github.com/umap-project/umap/releases/new) and Generate release notes + paste it in `docs/changelog.md` + finish Github process for a new release
7. Commit the changelog `git commit -am "changelog"`
8. `make build`
9. `make publish`
10. `make docker`

## Deploying instances

### OSMfr

Makefile on @yohanboniface computer. TODO: share it :)

### ANCT

Update the [Dockerfile](https://gitlab.com/incubateur-territoires/startups/donnees-et-territoires/umap-dsfr-moncomptepro/-/blob/main/Dockerfile?ref_type=heads) with correct version and put a tag `YYYY.MM.DD` in order to deploy it to production.
