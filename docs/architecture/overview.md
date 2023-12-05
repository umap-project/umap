# Overview of uMap

uMap is a server and a client. The server is build with the Django framework, and the client uses (vanilla) JavaScript, on top of Leaflet.

Basically, here is how it works:

- Most of the data is stored as [geoJSON files](https://datatracker.ietf.org/doc/html/rfc7946), on the server.
- Some other parts of the data is stored in the database (users, permissions, etc)
- PostGIS is used for some of its geo features, but for the most part, the computation is done on the frontend with Leaflet.

The server is meant to be a simple layer to do the storage and serve the JavaScript.