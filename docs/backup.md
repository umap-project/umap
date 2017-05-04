# Backups

There are two important places where your data are located,
in your database and in your media folder. The following `umap` commands
might help you to backup these data:

## `backup`

The `backup` command requires a `path` as a parameter where two archives
will be generated:

* `<path>/database.<isodate>.tar.gz` contains a JSON dump of the database
  ready to be passed to a `loaddata` command.
* `<path>/media.<isodate>.tar.gz` contains the content of your media
  folder as declared in your `MEDIA_ROOT` setting.

### Examples

```
umap backup /tmp/test_backup
```

will generate (if run on May, 4th 2017!):

```
/tmp/test_backup/database.2017-05-04.tar.gz
/tmp/test_backup/media.2017-05-04.tar.gz
```

## `sync_backup`

The `sync_backup` command requires a `path` as a parameter and
a `destination` to synchronize to.

It will take both database and media archives files for the current day
and `rsync` these to the destination.

### Examples

```
umap sync_backup /tmp/test_backup root@ip:/backups
```

will sync generated files from the `backup` command to your distant server.
