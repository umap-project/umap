# Docker

An official uMap docker image is [available on the docker hub](https://hub.docker.com/r/umap/umap). But, if you prefer to run it with docker compose, here is the configuration file:

```yaml title="docker-compose.yml"
version: '3'
services:
  db:
    # check https://hub.docker.com/r/postgis/postgis to see available versions
    image: postgis/postgis:14-3.4-alpine
    environment:
      - POSTGRES_HOST_AUTH_METHOD=trust
    volumes:
      - umap_db:/var/lib/postgresql/data

  app:
    # Check https://hub.docker.com/r/umap/umap/tags to find the latest version
    image: umap/umap:2.0.2
    ports:
      # modify the external port (8001, on the left) if desired, but make sure it matches SITE_URL, below
      - "8001:8000"
    environment:
      - DATABASE_URL=postgis://postgres@db/postgres
      - SITE_URL=https://localhost:8001/
      - STATIC_ROOT=/srv/umap/static
      - MEDIA_ROOT=/srv/umap/uploads
    volumes:
      - umap_userdata:/srv/umap/uploads
      # FIX the path on the left, below, to your location 
      - /home/ubuntu/umap.conf:/etc/umap/umap.conf
    restart: always
    depends_on:
      - db
    
volumes:
  umap_userdata:
  umap_db:
```

Note that you’ll have to set a [`SECRET_KEY`](https://docs.djangoproject.com/en/5.0/ref/settings/#secret-key) environment variable that must be secret and unique. One way to generate it is through the `secrets` module from Python:

```sh
$ python3 -c 'import secrets; print(secrets.token_hex(100))'
```
