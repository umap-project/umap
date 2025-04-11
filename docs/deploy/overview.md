# Deploying uMap

uMap is a python package, running [Django](https://docs.djangoproject.com/en/5.2/howto/deployment/),
so anyone experimented with this stack will find it familiar, but there are some speficic details
to know about.

## Data
One important design point of uMap is that while metadata are stored in a PostgreSQL database, the
data itself is stored in the file system, as geojson files. This design choice has been made
to make uMap scale better, as there are much more reads than writes, and when some
map is shared a lot (like on a national media) we want to be able to serve it without needing an
overcomplex and costly stack.

So when a request for data is made (that is on a *DataLayer*), the flow is that uMap will read
the request headers to check for permissions, and then it will forward the request to Nginx,
that will properly serve the data (a geojson file), without consuming a python worker, and with
much more efficiency than python.

In DEBUG mode, uMap will serve the geojson itself, but this is not recommended in production,
unless you have a very small audience.

Data can also be stored in a [S3 like storage](../config/storage/#using-s3).

## Assets (JS, CSS…)
As any web app, uMap also needs static files to be served. In DEBUG mode, Django will do this
kindly, but not in production. See [Nginx configuration](nginx.md) for this.

Assets can also be stored in a [S3 like storage](../config/storage/#using-s3).

## python app (metadata, permissions…)

uMap needs a python server, which can either be of [WSGI](wsgi.md) or [ASGI](asgi.md) (this later
is needed in order to use the collaborative live editing).

## Redis

Still when using the collaborative live editing, uMap needs a [Redis](../config/settings.md#redis_url) server, to act as pubsub.
