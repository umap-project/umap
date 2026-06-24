# Icons

Icons (aka pictograms in uMap sources) can be used in your map markers.

Icons are not embedded in uMap sources, you will have to add them, so you can choose which icons you want to use.

You can use any image format, but SVG files are recommended. The image will be displayed in a 24px square.

When using SVG, it's recommended to use icons without color. uMap will switch to white colors
automatically according to the marker background color.

Example of icons libraries you may want to use:

- [Pinhead](https://pinhead.ink/)
- [Maki Icons](https://labs.mapbox.com/maki-icons/)
- [Osmic Icons](https://gitlab.com/gmgeo/osmic)
- [SJJB Icons](http://www.sjjb.co.uk/mapicons/contactsheet)
- [Remix](https://remixicon.com/)


## Static folders

The easiest way to add icons is to put them in a folder and use the
[UMAP_PICTOGRAMS_COLLECTIONS](./settings.md#umap_pictograms_collections) setting.
This setting is a dict of dicts, each of which represents a collection:

```python title="settings.py"
UMAP_PICTOGRAMS_COLLECTIONS = {
    "MyCollection": {"path": "/absolute/path/to/collection", "attribution": "Someone"},
    "OtherCollection": {"path": "relative/path/to/other", "attribution": "Else"},
}
```

`path` can be either relative or absolute.

### if `path` is absolute

Important: the destination folder must contain a `pictograms` subfolder (not to
conflict with other paths when running `collectstatic`).

Inside of it, each subfolder will be used as a category.

Example:

```
└── pictograms
    ├── accommodation
    │   ├── hostel.svg
    │   ├── hotel.svg
    │   └── motel.svg
    ├── administration
    │   ├── courthouse.svg
    │   ├── embassy.svg
    │   ├── government.svg
    │   ├── prison.svg
    │   └── town-hall.svg
    ├── amenity
    │   ├── cemetery.svg
    │   ├── cinema.svg
    │   ├── clock.svg
    │   ├── entrance.svg
    │   ├── exit.svg
    │   ├── library.svg
    …
```

### if `path` is relative

The `path` will be searched in the staticfiles directories.

Each subfolder will be used as a category.

Example:

```
.
└── umap
    ├── dsfr-lite
    │   ├── icons
    │   │   ├── buildings
    │   │   │   ├── ancient-gate-fill.svg
    │   │   │   ├── ancient-gate-line.svg
    │   │   │   ├── ancient-pavilion-fill.svg
    │   │   │   ├── ancient-pavilion-line.svg
    │   │   │   ├── bank-fill.svg
    │   │   │   ├── bank-line.svg
    │   │   │   ├── building-fill.svg
    │   │   │   ├── building-line.svg
    │   │   │   ├── community-fill.svg
    │   │   │   ├── community-line.svg
    │   │   │   ├── government-fill.svg
    │   │   │   ├── government-line.svg
    │   │   ├── business
    │   │   │   ├── archive-fill.svg
    │   │   │   ├── archive-line.svg
    │   │   │   ├── attachment-fill.svg
    │   │   │   ├── attachment-line.svg
    │   │   │   ├── award-fill.svg
    │   │   │   ├── award-line.svg
    │   │   │   ├── bar-chart-box-fill.svg
    │   │   │   ├── bar-chart-box-line.svg
…
```

In this case, the setting will look like:
```python title="settings.py"
UMAP_PICTOGRAMS_COLLECTIONS = {
    "DSFR": {
        "path": "umap/dsfr-lite/icons",
        "attribution": "Système de design de l’État",
    },
}
```

## Import icons manually (deprecated)

You can import icons manually by going to your uMap admin page: `https://your.server.org/admin`

Note: if you used pictograms added through the admin (or from the deprecated command `umap import_pictograms`),
you can dump them in a static folder using the command `umap export_pictograms`.


## Protips

To resize and clean massively SVG files:

    for i in **.svg; mkdir -p export/(dirname $i); rsvg-convert -w 24 -h 24  $i -a -f svg -o export/(dirname $i)/(basename $i); end
