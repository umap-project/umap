# Docker

An official uMap docker image is [available on the docker hub](https://hub.docker.com/r/umap/umap). But, if you prefer to run it with docker compose, here is the configuration file:

```yaml title="docker-compose.yml"
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
    image: umap/umap:2.9.3
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
      # OPTIONAL, you can comment the line below out for default
      # values to apply
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

User accounts can be managed via the Django admin page ({SITE_URL}/admin). The required superuser must be created on the container command line with this command:
```bash
umap createsuperuser
```

## Developping with Docker

If you want to develop with podman or docker, here are commands that might be useful, given that you have a postgreSQL server running locally and that your settings are located at `umap.conf`:

You can build the docker image with:

```bash
podman build -t umap .
```

And run it with:

```bash
podman run -v ./umap.conf:/tmp/umap.conf -e UMAP_SETTINGS=/tmp/umap.conf -it --network host umap  
```

## Real time collaboration

To enable real time collaboration when using Docker, a Redis service must be added. Something like this in `docker-compose.py` world:

```yaml title="docker-compose.yml"
services
  redis:
    image: redis:latest
    healthcheck:
      test: ["CMD-SHELL", "redis-cli ping | grep PONG"]
…
    command: ["redis-server"]
…
  app:
    depends_on:
…
      redis:
        condition: service_healthy
…
    environment:
      - REALTIME_ENABLED=1
      - REDIS_URL=redis://redis:6379
…

```
