# Administration

You can access uMap administration page by navigating to `https://your.server.org/admin`

You will have to connect with the admin account created during installation. Default admin username is "umap".

## Icons

Icons (aka pictograms in uMap sources) can be used in your map markers.

Icons are not embedded in uMap sources, you will have to add them manually. So you can choose which icons you want to use.

You can use either PNG, JPG or SVG files. SVG files are recommanded.

When using SVG, it's recommanded to use icons without color. UMap will switch to white colors
automatically according to the marker background color.

Example of icons libraries you may want to use:

- [Maki Icons](https://labs.mapbox.com/maki-icons/) (icon set made for map designers)
- [Osmic Icons](https://gitlab.com/gmgeo/osmic)
- [SJJB Icons](http://www.sjjb.co.uk/mapicons/contactsheet)
- [Remix](https://remixicon.com/)

### Import icons manually

You can import icons manually by going to your uMap admin page: `https://your.server.org/admin`

### Import icons automatically

To import icons on your uMap server, you will need to use command `umap import_pictograms`.

Note: you can get help with `umap import_pictograms -h`

Basic usage:

    umap import_pictograms --attribution "Maki Icons by Mapbox" path/to/icons/directory/

### Categories

uMap can render icons grouped into categories. When using the import script, any
subfolder will be used as category.
