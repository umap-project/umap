!!! example "This is an ongoing work."

    [Let us know](https://github.com/umap-project/umap/issues)
    if you are interested [to translate it from French](/fr/tutorials/6-handling-datalayers/).


## Expanding layers and groups

In the data browser, use the arrow or the layer/group heading to expand or
collapse its contents. In **Manage layers**, group headings also show a disclosure
arrow. Use the eye button to show or hide data on the map; collapsing a list does
not hide its features.

### Initial group state

In the map's **Advanced properties → User interface options**, enable **Collapse
layer groups on load** to start with a compact group overview. The option is off
by default, preserving the existing initial behavior.

For an individual group, open its properties and choose **Group in the data
browser on load**:

- **Use map setting** follows the map-wide option.
- **Expanded** starts that group expanded.
- **Collapsed** starts that group collapsed.

Save the map after changing these settings. A group's explicit choice takes
precedence over the map-wide option. Nested groups have their own choices;
an expanded child does not automatically expand a collapsed parent.

### Remembering your view

After you manually expand or collapse a layer or group, the data browser remembers
that choice for this map in your browser, including after reloading or reopening
the map. Each layer's feature list keeps its own state when its parent group is
closed. Your last choice takes precedence over the initial settings and applies
in both data-browser modes.

These preferences do not change the saved map, layer visibility, or another
visitor's view. A new browser, or clearing this site's browser data, restores the
initial settings. If browser storage is blocked or full, navigation still works,
but preferences may only last for the current visit. The editing tree in
**Manage layers** continues to start expanded.
