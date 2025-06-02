# Management commands

## Command `purge_old_versions`

Old versions are usually deleted on save of a datalayer, but we still keep [`UMAP_KEEP_VERSIONS`](../config/settings.md#umap_keep_versions).
Let's say after some time even those versions could be deleted, to save some space.
This is to be used as a daily cron.


### Options

* `--dry-run`: only print candidate datalayers without any effective deletion.
* `--days`: number of days prior to today considered for deletion, only select datalayers within that time range (days => today)
* `--initial`:
