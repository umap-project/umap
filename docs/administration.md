# Administration

You can access uMap administration page by navigating to `https://your.server.org/admin`

You will have to connect with the admin account created during installation. Default admin username is "umap".

## Icons

Icons (aka pictograms in uMap sources) can be used in your map markers.

Icons are not embedded in uMap sources, you will have to add them manually. So you can choose which icons you want to use.

Example of icons libraries you may want to use:

- [Maki Icons](https://labs.mapbox.com/maki-icons/) (icon set made for map designers)
- [Osmic Icons](https://gitlab.com/gmgeo/osmic)
- [SJJB Icons](http://www.sjjb.co.uk/mapicons/contactsheet)

### Import icons manually

You can import icons manually by going to your uMap admin page: `https://your.server.org/admin`

### Import icons automatically

To import icons on your uMap server, you will need to use command `umap import_pictograms`

Note, you can get help with `umap import_pictograms -h`

In this example, we will import Maki icons.

First, we download icons from main site. Inside the downloaded archive, we keep only the icons folder that contains svg files. Place this folder on your server.

Go inside icons folder and remove tiny icons: `rm *-11.svg`

Now, we will use imagemagick to convert svg to png.

`for file in *.svg; do convert -background none $file ${file%15.svg}24.png; done`

To have white icons use:
`for file in *.svg; do convert -background none -fuzz 100% -fill white -opaque black $file ${file%15.svg}24.png; done`


Notes:
- you may also want to resize image with option `-resize 24x`
- this solution is not optimal, generated png are blurry.

This will convert the svg to png and rename them from `*-15.svg` to `*-24.png`

Now we will import icons. Note: icons names must end with `-24.png`

`umap import_pictograms --attribution "Maki Icons by Mapbox" icons`

Done. Icons are imported.
