# Frequently Asked Questions (FAQ)

## Which syntax is allowed in description fields? {: #text-formatting }

* `*single star for italic*` → *single star for italic*
* `**double star for bold**` → **double star for bold**
* `# one hash for main heading` ⤵ <h1>one hash for main heading</h1>
* `## two hashes for second heading` ⤵ <h2>two hashes for second heading</h2>
* `### three hashes for third heading` ⤵ <h3>three hashes for third heading</h3>
* `Simple link: [[http://example.com]]` → Simple link: [http://example.com](http://example.com)
* `Link with text: [[http://example.com|text of the link]]` → Link with text: [text of the link](http://example.com)
* `--- for a horizontal rule` ⤵ <hr>

## What are the available keyboard shortcuts? {: #keyboard-shortcuts}

With macOS, replace `Ctrl` by `Cmd`.

### Globals

* `Ctrl+F` → open search panel
* `Ctrl+E` → switch to edit mode
* `Escape` → close open panel or dialog
* `Shift+drag` on the map → zoom to this map extent
* `Shift+click` on the zoom buttons → zoom in/out by 3 levels

### In edit mode

* `Ctrl+E` → back to preview mode
* `Ctrl+S` → save map
* `Ctrl+Z` → undo all changes until last save
* `Ctrl+M` → add a new marker
* `Ctrl+P` → start a new polygon
* `Ctrl+L` → start a new line
* `Ctrl+I` → open importer panel
* `Ctrl+O` → open importer panel and file browser
* `Ctrl++` → zoom in
* `Ctrl+-` → zoom out
* `Shift+click` on a feature → edit this feature
* `Ctrl+Shift+click` on a feature → edit this feature layer

## Which syntax is allowed in conditional rules? {: #conditional-rules }

* `mycolumn=odd` → will match features whose column `mycolumn` equal `odd`
* `mycolumn!=odd` → will match features whose column `mycolumn` is missing or different from `odd`
* `mycolumn>12` → will match features whose column `mycolumn` is greater than `12` (as number)
* `mycolumn<12.34` → will match features whose column `mycolumn` is lower than `12.34` (as number)
* `mycolumn=` → will match features whose column `mycolumn` has no or null value
* `mycolumn!=` → will match features whose column `mycolumn` has any defined
* `mycolumn=true/false` → will match features whose column `mycolumn` is explicitely `true` (or `false`)
* `mycolumn!=true/false` → will match features whose column `mycolumn` is different from `true` (or `false`)

When the condition matches, the associated style will be applied to the corresponding feature. When multiple rules
define the same property, the first matching rule wins.

For example, let's imagine those rules defined in that order:
- `population>10000` then apply `color=red`
- `population>1000` then apply `color=orange`
- `unemployment<10` then apply `pictogram=default`
- `unemployment>10` then apply `pictogram=warning`

Now:
- for a feature with `population=1300` and `unemployment=8`, the `color` will be `orange` and `pictogram` will be `default`
- for a feature with `population=1300` and `unemployment=12`, the `color` will be `orange` and `pictogram` will be `warning`
- for a feature with `population=20000` and `unemployment=15`, the `color` will be `red` and `pictogram` will be `warning`


## How to use variables? {: #variables}

In general, using a variable is as simple as `{myvar}`.

It's possible to define another variable as fallback of the first one like this: `{myvar|fallbackvar}`.

To fallback to a string, add it between double quotes: `{myvar|"fallback"}`.

It's possible to combine more variables: `{myvar|othervar|"some string"}`.

It's possible to use a variable inside an URL, for example: `[[https://domain.org/?locale={locale}|Wikipedia]]`.

Or even as source for an image: `{{{myvar}}}` (note the triple `{}`).

### Available variables for features:

Those variables can be used in a feature description, or in popup content templates.

Any property of the feature will be available, plus:

- `{lat}/{lng}` → the feature position (or centroid in case of line or polygon)
- `{alt}` → the altitude of a marker, if defined in the data
- `{locale}` → the locale in the form `en` or `en_US` when a variant is used
- `{lang}` → the lang in the form `en` or `en-us` when a variant is used
- `{measure}` → the length of a line or the area of a polygon
- `{gain}`/`{loss}` → the elevation gain/loss of a line (only if it contains the altitude information)
- `{rank}` → the rank of the feature in the layer
- `{layer}` → the name of the feature's layer
- `{zoom}` → the current map zoom

### Available variables in URL for remote data:

- `{bbox}` → the current bbox of the map in the form `southwest_lng,southwest_lat,northeast_lng,northeast_lat`
- `{north}/{top}` → the North latitude of the current map view
- `{south}/{bottom}` → the South latitude of the current map view
- `{east}/{right}` → the East longitude of the current map view
- `{west}/{left}` → the West longitude of the current map view
- `{zoom}` → the current map zoom
- `{lat}` → the latitude of the current map center
- `{lng}` → the longitude of the current map center


## Which statuses can have a map? {: #map-statuses}

### Access statuses

* **Draft (private)**: Only you and your collaborators are able to see the map.
* **Everybody (public)**: Everybody can see your map, it is listed on search results and potentially the homepage. It is indexed by search engines like Google.
* **Anyone with link**: The map will be accessible only to people knowing the link. The map is not indexed by search engines.
* **Editors and team only**: Only you and your collaborators will be able to see the map.

Providing a link of a map to unallowed people will display a `403 Forbidden` error.

### Edit statuses

* **Owner only**: only the owner of the map can edit it.
* **Editors and team only**: the owner, editors and members of the linked team will be able to edit the map.
* **Everyone**: Everybody can edit the map without even being logged in.

Only for maps created without an account:

* **Only editable with secret edit link**: Only people with a secret link will be able to edit the map.

These settings are also available for each layer.
