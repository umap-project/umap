# The frontend

!!! info "These are notes"

    Consider this page as notes taken while exploring uMap. It's not covering everything but hopefully will help you get a basic understanding of how things work.

uMap uses Leaflet on the frontend. A lot of uMap objects extends the ones from Leaflet with additional abilities.

```mermaid
erDiagram
    Map ||--o{ DataLayer : datalayers
    Map{
	    JSON permissions
	    JSON metadata
    }
    DataLayer ||--o{Feature : data
    DataLayer {
	    JSON metadata
	    JSON permissions
    }
```

Here are the important concepts and files:

- `umap.js` contains `Map`, the map object. It's the main entry point, which references all the related properties. It contains metadata, permissions, and data layers.
- `umap.layer.js` contains `DataLayer`, which contains metadata, permissions, and data.
- `umap.permissions.js` handles the permissions of the map. There is a different file handling the permissions of the datalayer:
- `umap.datalayer.permissions.js`.

## Map (`U.Map`)

`U.Map` is the class that's called by the server templates (in `map_init.html` and `map_fragment.html` used when we display lists of maps, like the homepage).

It contains references to datalayers, and to the controls (the buttons that appears on the map)

To be able to change the way the client behaves, querystring parameters can be used to overload the settings stored in the database. This is useful for instance when using iframes to display the map on a different website.

uMap has an edit mode. If you don't have the rights you cannot save nor edit, you can't edit the permissions as well.

A map contains references to:

- controls
- datalayers

## DataLayers (`U.Datalayer`)

The datalayers contains data, and a layer (a way to represent them).

Each data layer contains a "layer", to know what type of layer it is. It's one of:

- Choropleth (`U.Layer.Choropleth`)
- Cluster (`U.Layer.Cluster`)
- Heat (`U.Layer.Heat`)

When the data layers are initialized, they can have two states:
- `loaded`: the object is loaded in memory. At this stage we have access to all the datalayer's metada (name, type, id)
- `dataLoaded` : the data is available to be used, so we can for instance compute the center of the map (when it's dynamic).

- `backupOptions` is here to make it possible to cancel what have been done (using undo). It stores the old settings for the data-layer.

## Storage

To mark what needs to be synced with the server, uMap currently mark objects as "dirty". Something marked as "dirty" has changed on the client, but is not yet saved on the server.

Each map, datalayer and permission objects can be marked as "dirty". When a change is made on an object, it will mark its parent as "dirty" as well, so it can be updated accordingly.
