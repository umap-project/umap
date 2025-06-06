# Management commands

## `anonymous_edit_url`

Retrieve anonymous edit url of a map, from its id.

Eg.: `umap anonymous_edit_url 1234`

### options

* `--lang LANG`: Language code to use in the URL (default `en`).

## `clean_tilelayer.py`

Clean tilelayers in map settings.

This will simply replace the URL in maps settings:

    umap clean_tilelayer http://my.old/url/template http://my.new/url/template

This will replace the whole tilelayer in maps settings by the one with this name:

    umap clean_tilelayer http://my.old/url/template "some string"

This will replace the whole tilelayer in maps settings by the one with this id:

    umap clean_tilelayer http://my.old/url/template an_id

This will delete the whole tilelayer from maps settings:

    umap clean_tilelayer http://my.old/url/template

To get the available tilelayers in db (available for users):

    umap clean_tilelayer --available

To get statistics of tilelayers usage in db (including custom ones):

    umap clean_tilelayer --available

### Options

* `--available`: list known tilelayers.


## `empty_trash`

Remove maps in trash.
Eg.: `umap empty_trash --days 7`

### Options

* `--days DAYS`: number of days to consider maps for removal
* `--dry-run`: pretend to delete but just report

## `import_pictograms`

Import pictograms from a folder.

### Options

* `--attribution ATTRIBUTION`: attribution of the imported pictograms
* `--extensions EXTENSIONS [EXTENSIONS ...]`: optional list of extensins to process
* `--exclude EXCLUDE [EXCLUDE ...]`: optional list of files or dirs to exclude
* `--force`: update picto if it already exists


## `migrate_to_s3`

Migrate latest datalayers from filesystem to S3.

## `purge_old_versions`

Old versions are usually deleted on save of a datalayer, but we still keep [`UMAP_KEEP_VERSIONS`](../config/settings.md#umap_keep_versions).
Let's say after some time even those versions could be deleted, to save some space.
This is to be used as a daily cron, and by default it will select every datalayer last modified
exactly 360 days ago.

### Options

* `--dry-run`: only print candidate datalayers without any effective deletion.
* `--days-ago`: select datalayers which where last modified that many days ago (default: 360).
* `--days-to-select`: how many days before `days-ago` to consider, use `0` to put not limit (default: 1).

## `switch_user`

Command to use when some user created a new account and wants to retrieve maps from an old account.
The command will replace old user by new:
- as map owner
- as map editors
- as team member

Eg.: `umap switch_user oldUserName newUserName --delete-user`

### Options

* `--dry-run`: only print candidate datalayers without any effective deletion.
* `--delete-user`: if true, delete old user at the end of the process.
