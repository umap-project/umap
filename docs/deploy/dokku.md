# Deploying uMap with Dokku

You must have a Dokku host up and running. This can be either self hosted, or from a provider.

To set up Dokku on your own server, see https://dokku.com/docs/getting-started/installation/

Dokku has several deployement method, in this guide we'll use the Docker based one, using our [maintained Dockerfile](docker.md).

## Installation

### Prepare the host

We need postgres and redis plugins:

```bash
sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git --name postgres
sudo dokku plugin:install https://github.com/dokku/dokku-redis.git --name redis
```

Note: if you do not use the real time collaboration feature, you can skip the redis part.

Create the `umap` app (or name it as you prefer), and posgis and redis services:

```bash
dokku apps:create umap
dokku postgres:create umap --image "postgis/postgis" --image-version "18-3.6-alpine"
dokku postgres:link umap umap
dokku redis:create umap
dokku redis:link umap umap
```

Create a folder for user data (mainly layers) and static files:

```bash
sudo mkdir /var/lib/dokku/data/storage/umap-data
dokku storage:mount umap /var/lib/dokku/data/storage/umap-data:/srv/umap/uploads
sudo mkdir /var/lib/dokku/data/storage/umap-static
dokku storage:mount umap /var/lib/dokku/data/storage/umap-static:/srv/umap/static
```

Expose the app to the Internet and add a SSL certificate:

```bash
dokku domains:set-global dokku.yourdoma.in
dokku config:set umap CSRF_TRUSTED_ORIGINS=https://umap.dokku.yourdoma.in
dokku ports:set umap http:80:8000
sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git
dokku letsencrypt:enable umap
dokku letsencrypt:cron-job --add
```

Note: we are using Letsencrypt here, see [Dokku's doc](https://dokku.com/docs/configuration/ssl/)
for a custom certificate.

Configure via env vars:

```bash
dokku config:set --no-restart umap SECRET_KEY=something-random-and-unique
```

### Nginx configuration

Nginx configuration for uMap is a bit tricky, and we don't want to replace
the nginx conf managed by Dokku, so it requires some manual changes.

Some changes need to be added to the `http` section of the nginx conf.

Create a file at `/etc/nginx/conf.d/umap-http.conf` with this content:

```nginx title="/etc/nginx/conf.d/umap-http.conf"
proxy_cache_path /tmp/nginx_ajax_proxy_cache levels=1:2 keys_zone=ajax_proxy:10m inactive=60m;
proxy_cache_key "$uri$is_args$args";

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

Other need to be integrated in the `server` section.

So, create a file at `/home/dokku/umap/nginx.conf.d/umap.conf`, with this content, but
adapt the `alias` to match the volumes created above (`/static/` => `/var/lib/dokku/data/storage/umap-static`,
`/data/` => `/var/lib/dokku/data/storage/umap-data`):

```nginx title="umap.conf"
--8<-- "docker/umap-snippet.conf"
```

### OAuth configuration

As an example, we'll use OpenStreetMap OAuth, but it's possible to use whatever service supported
by [python-social-auth](https://python-social-auth.readthedocs.io/en/latest/).

You need to create an OAuth client here:

https://www.openstreetmap.org/oauth2/applications

The redirect URL should look like:

```
https://umap.dokku.yourdoma.in/complete/openstreetmap-oauth2/
```

You must select `Read user preferences` and `Sign in using OpenStreetMap` permissions.

And get the client key and secret and set them in Dokku like this:

```bash
dokku config:set --no-restart umap SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_KEY=somekey
dokku config:set --no-restart umap SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_SECRET=somesecret
dokku config:set umap SOCIAL_AUTH_REDIRECT_IS_HTTPS=1
```

### More settings

If you want real time collaboration:

```bash
dokku config:set umap REALTIME_ENABLED=1
```

If you want to control whether anonymous users can create maps:

```bash
dokku config:set umap UMAP_ALLOW_ANONYMOUS=0/1
```

See [settings](../config/settings.md).


### On your local machine

To deploy, you need to clone umap locally, and push to Dokku, just like
you'd push to github or the like.

On uMap git repository, add a remote (here name `dokku`, but it's up to you)
and push there the `master` branch (or whatever branch you want):

```bash
git remote add dokku dokku@yourdokku.com:yourproject
git push dokku master
```

### Troubleshooting

See the logs, on the host:

```bash
dokku logs umap
```

Start a shell session on the umap Docker container:

```bash
dokku enter umap
```
