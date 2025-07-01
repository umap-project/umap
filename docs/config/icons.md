# Icons

Icons (aka pictograms in uMap sources) can be used in your map markers.

Icons are not embedded in uMap sources, you will have to add them, so you can choose which icons you want to use.

You can use any image format, but SVG files are recommended. The image will be displayed in a 24px square.

When using SVG, it's recommended to use icons without color. uMap will switch to white colors
automatically according to the marker background color.

Example of icons libraries you may want to use:

- [Maki Icons](https://labs.mapbox.com/maki-icons/) (icon set made for map designers)
- [Osmic Icons](https://gitlab.com/gmgeo/osmic)
- [SJJB Icons](http://www.sjjb.co.uk/mapicons/contactsheet)
- [Remix](https://remixicon.com/)


## Static folder

The easiest way to add icons is to put them in a folder and use the [UMAP_PICTOGRAMS_COLLECTIONS](./settings.md#umap_pictograms_collections) setting.
This setting is a dict of dicts, each of which represents a collection:
```python title="settings.py"
UMAP_PICTOGRAMS_COLLECTIONS = {
    "MyCollection": {"path": "/path/to/collection", "attribution": "Someone"},
    "OtherCollection": {"path": "/path/to/other", "attribution": "Else"},
}
```
Each path expects a `pictograms` root folder (so not to conflict with other paths when running `collectstatic`), and inside of it one subfolder
for each category containing a list of pictograms file. Eg.:
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

## Import icons manually (deprecated)

You can import icons manually by going to your uMap admin page: `https://your.server.org/admin`

Note: if you used pictograms added through the admin (or from the deprecated command `umap import_pictograms`),
you can dump them in a static folder using the command `umap export_pictograms`.
