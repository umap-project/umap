!!! abstract "Learnings"

    - Create a map from a GPX file
    - Display an elevation chart for that trace


## 1. Create a map from a GPX file

You simply have to drag&drop a GPX file above the map to automagically create a datalayer with these data.

![Screenshot of a browser with a GPX file hover](../../static/tutoriels/gpx-import-drag-and-drop.png)

A line should appear on the map with optional pre-defined points according to your source file:

![Screenshot of the map with the trace](../../static/tutoriels/gpx-import-result.png)


## 2. Display an elevation chart

Perform a right-click **on the line** and choose the editing pencil.


Open `Interaction options` and switch `Popup shape` to `Popup (large)` to give some room to the incoming graph.
Then change the `Popup content style` from `Default` to `Route`.

You should see the popup in the background gaining an elevation graph:


![Screenshot of the map with the configuration panel and the popup](../../static/tutoriels/gpx-configuration-popup.png)

You’ll notice that when hovering the graph, the current position is made visible on the map (orange point on the line) and the elevation is dynamically updated within the popup:

![Screenshot of the map with the elevation graph](../../static/tutoriels/gpx-elevation-graph.png)

*Enjoy your hike!*
