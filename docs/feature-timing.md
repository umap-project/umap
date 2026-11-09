# Feature timing

Markers, lines (including routes), and polygons each have an **Enable timing**
switch in their feature editor's **Feature timing** section. Nothing is
inherited dynamically from a layer. Layer presets can be copied to new drawings.
Imported remote data is not managed by this cleanup.

- **Hide from** is optional. At the start of this date the feature is filtered
  out of normal rendering and the data browser, but remains stored and available
  in editing mode. An already open viewer schedules this visibility change.
- **Delete on**, or a calculated delay after hiding, is required when timing is enabled.
  It makes the feature due for the selected expiry action at the start of this date.
- **At expiration** selects deletion (the default) or moving to a saved local
  destination layer on the same map. In move mode the date is labelled **Move on**.
- Without Hide from, normal viewing hides the feature at the expiry boundary.
  Open viewers schedule this change too, even if the worker has not run yet.
  Actual deletion or movement happens on the next successful worker pass.
- Disabling cleanup disables both deadlines; ordinary features keep their
  existing behavior. Changing dates before cleanup changes the next deadline.

Dates are strict Gregorian calendar dates `YYYY-MM-DD` or `DD.MM.YYYY`, from `0001-01-01` to
`9999-12-31`. Both boundaries are inclusive at **00:00:00 UTC**, independent
of browser language, browser timezone, the server's local timezone, and DST.
Hide from must be on or before Delete on. Invalid dates, non-boolean activation,
missing deletion dates, and missing/duplicate timed feature IDs are rejected.
Client checks improve feedback; the server validates uploads independently.

Hiding is not access control. The GeoJSON, export and historical versions can
still contain hidden features. Deletion changes the current layer; it does not
erase retained historical versions or backups. Existing version retention still
applies. A viewer already holding layer data may need a reload to see a server
deletion. Open editors can inspect hidden features until they are actually
deleted, and must reload after a cleanup conflict.

## Server operation

Apply the Django migrations before enabling the worker. Run:

```sh
umap cleanup_expired_features --dry-run
umap cleanup_expired_features
```

Configure the second command to run every minute using the installation's
scheduler, or supervise a continuously running worker:

```sh
umap cleanup_expired_features --loop
```

The loop waits 60 seconds after each pass. Actual deletion occurs on the next
successful pass after the UTC deadline, not at an exact guaranteed second.
After downtime, the next pass catches up. No browser or user login is required.
Operators must supervise this process and monitor its output/errors; installing
the code alone does not install a system service. No production service has
been configured by this change.

The initial implementation scans current, non-deleted layers, one transaction
at a time. It skips remote layers. Invalid layers are logged and left unchanged.
This deliberately avoids a second deadline index which could become stale after
an import or reschedule; very large installations should measure scan duration.

## Concurrent editors and versions

Cleanup and HTTP layer updates first lock the map row, then PostgreSQL layer rows. Cleanup
reads the latest schedule under that lock, removes due features, writes a new
GeoJSON through the existing storage backend, and records their IDs in the
`ExpiredFeature` table. A completed reschedule is therefore seen by cleanup;
if cleanup wins first, the editor cannot bring the deleted feature back.

For layers containing active schedules or deletion IDs, saves require the exact
current `X-Datalayer-Reference`. A missing or stale reference returns HTTP 412,
with a reload message rather than the usual force-save action. Untimed layers
retain the existing optimistic merge behavior. Deletion IDs also reject an
upload using a current reference if it contains a previously expired feature.
This covers changed dates, removed timing options, historical restores and
realtime peers receiving an updated reference. IDs survive version purging.

The edit journal transfers each schedule as one complete value, including its
first creation, undo and redo. A second editor does not need to open the feature
first to receive its schedule. Concurrent schedule changes follow the journal's
existing ordering for that whole value. Merely opening a feature's editor does
not add timing metadata to an ordinary feature.

An automatically deleted feature cannot be restored in that same layer with
the same ID, including through an intentional historical restore. A deliberate
new copy needs a new ID. Protection is scoped to the original layer, not to
exports, copied maps, other layers or independently deployed installations.
This is protection against stale application saves, not protection against a
database administrator or custom code writing storage directly.

File storage and PostgreSQL do not share a distributed transaction. As with
existing uMap versioned saves, interrupted storage writes can leave an orphan
version; operators still need backups and normal storage monitoring. Filesystem
tests cover the new workflow; S3 version retention is tested with mocked AWS
storage, not against a deployed S3 service.

## Optional archiving instead of deletion

The move option implements the extension proposed in
[#3333](https://github.com/umap-project/umap/issues/3333#issuecomment-4909994691).
It runs **at the expiry date instead of deletion**, not at the optional earlier
Hide from date. The destination can be called Archive, Past Events or any other
name. It must already be saved, belong to the same map, be local and not a group,
and allow edits by the scheduler's source editing audience. A destination whose
effective edit policy is more restricted than the source is rejected, even for
an owner; the worker must not become an indirect privilege escalation. Target
permissions and eligibility are checked again at execution time.

Geometry, feature ID, properties, styles and route data are copied. Missing
column definitions are added without replacing definitions already present in
the destination. Destination layer styling, popup settings and visibility
remain its own. The copy's timing is disabled and its move settings are removed,
so it remains in the archive instead of expiring repeatedly. Its provenance is
stored in `_umap_options.timingArchive`. Users can edit it normally or explicitly
configure a new schedule later. No destination layer is created automatically.

The source gets a removal tombstone, so even a historical restore or an editor
with a refreshed version cannot recreate its moved ID in the source. Existing
unrelated IDs, previously expired IDs or previous transfer IDs in the destination
are never overwritten. A collision or invalid target leaves the source intact
and logs an error; it does not fall back to deletion.

Each move creates a durable `FeatureArchive` job before changing files. The job
temporarily stores a recovery copy. Under map/layer locks the worker writes the
target, verifies it through the storage API, and only then removes the source.
It then records completion and clears the recovery payload. Existing version
storage is used for both layers; retention hooks run after the pointer transaction
commits. Completed moves do not repeat. Two workers are serialized and a retry
recognizes its own copy rather than appending a duplicate.

Database rows and filesystem/S3 objects do not form one distributed transaction.
In particular, an S3 PUT may survive a database rollback. Pending jobs block
saves to both affected layers and resume on the next pass, including when the
source PUT completed before a failure. A persistent storage/permission error
requires operator attention. The service deliberately does not overwrite
conflicting data to force a job through. Read-only viewers can briefly observe
intermediate/cached state; this is recovery safety, not atomic cross-object reads.

Destination layers also maintain an `archive_generation` counter. The stored
collection carries `archiveGeneration`. A client acknowledges it only after
loading that collection, and sends `X-Umap-Archive-Generation` on save. Both the
header and uploaded collection must match the database generation. Websocket
reference-version updates cannot advance that acknowledgement. This prevents
an old destination editor from dropping newly archived features even after a
peer has supplied it with the current reference version. The counter survives
removal of individual transfer records. A deliberately edited current collection
can still remove objects normally. Old destination version restores can require
a reload instead of silently dropping archive additions.

Archived objects are visible according to their destination's visibility and
filters. An already loaded destination may require reload to show server-side
additions. Hiding and an archive layer are not access control. Source history,
destination history and backups can retain data, including historical recovery
payloads in database backups. Nothing here is an erasure guarantee.

A timeline slider remains outside this implementation; #836 is a separate feature.

## Column references and retention periods

Both date inputs accept an exact top-level property reference, such as `{end_date}`,
`{Ende}` or `{End of works}`. The name is case-sensitive and is not hard-coded.
This is a literal column lookup, not nested property access, code execution,
or the complete popup template language. uMap's existing normalization of
imported column names still applies. Values must use one of the two calendar
formats above; locale-dependent slash dates and timestamps are rejected.

An absent or empty referenced value pauses the whole schedule: no hiding or
cleanup until data is supplied. This lets a newly drawn object be saved before
its date is known. A malformed nonempty value rejects the save. Existing
malformed layers are logged and left unchanged by the worker. Changing the
property recalculates both dates; computed dates are not stored as a stale copy.

**Delete after hiding** accepts an integer from 1 to 36,500, measured in days
or calendar months. Enter either an absolute deletion date or a delay, not both.
The UI clears the other alternative when one is set. The delay requires Hide
from as its base. Days are added in UTC. Months retain the day number if it
exists; otherwise they use the last day of the destination month. For example,
31 January 2028 plus one month is 29 February, and 15 November 2026 plus three
months is 15 February 2027. Results beyond year 9999 are invalid.

**Use for new features in this layer** copies the current configuration into
the layer's `timingDefaults` property. Alternatively edit the layer's own
Feature timing section. Save the map to persist the preset. Explicit new
drawings (markers, lines, routes, polygons) copy this configuration once.
Loading existing objects, importing data, moving objects and receiving remote
journal updates do not apply it. Existing objects keep their schedules, and
changing a preset does not reschedule them. Each copied schedule can be edited
or disabled individually; there is no implicit inheritance from parent groups.

Example stored on a feature:

```json
{"enabled": true, "hideOn": "{end_date}", "deleteAfter": 3, "deleteUnit": "months"}
```

The feature's `end_date` column supplies the date. Omitted `deleteUnit` means days.
The client displays resolved dates in UTC. Referenced property inputs commit on
blur before save/preset clicks; timing inputs do not use the general text-input
debounce. Whole-schedule journal updates, row locks, deletion tombstones and
version retention continue to apply.

## Translations and review

Feature timing remains a separate, collapsed section alongside the existing
feature property sections. It controls visibility and lifetime, rather than
shape styling or click/popup behavior. It uses the same fieldset component as
the other sections.

The twenty-three frontend messages and ten server validation messages have proposed
translation drafts for all 47 configured languages in this development version.
The five additional legacy frontend JSON catalogs include the same frontend messages. Generated JavaScript modules and compiled gettext catalogs
must be regenerated with the existing `generate_js_locale` and `compilemessages`
commands after editing translations.

These are AI-assisted drafts requiring fluent/native-speaker review, especially
terminology in minority languages. Automated checks verify coverage, Unicode,
catalog compilation and loading; they do not establish linguistic correctness.
The upstream translation workflow is Transifex, as described in
[Contributing](contributing.md). These drafts have not been submitted to Transifex and are not approved translations.
