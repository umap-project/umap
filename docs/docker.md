# Docker

There is now an official [uMap](https://hub.docker.com/r/umap/umap) image.

To run it with docker compose, use a `docker-compose.yml` like this:

```yaml
version: '3'
services:
  db:
    image: postgis/postgis:14-3.3-alpine
    environment:
      - POSTGRES_HOST_AUTH_METHOD=trust
    volumes:
      - db:/var/lib/postgresql/data

  app:
    image: umap/umap:x.x.x
    ports:
      - "8001:8000"
    environment:
      - DATABASE_URL=postgis://postgres@db/postgres
      - SECRET_KEY=some-long-and-weirdly-unrandom-secret-key
      - SITE_URL=https://umap.local/
      - UMAP_ALLOW_ANONYMOUS=True
      - DEBUG=1
    volumes:
      - data:/srv/umap/uploads

volumes:
  data:
  db:
```

### Create superuser

With docker-compose, run `docker-compose run app /venv/bin/umap createsuperuser`


### Custom settings

Some basic settings are available through env vars (see https://github.com/umap-project/umap/blob/master/umap/settings/base.py),
but if you need more custom ones (like custom OAuth configuration), the easiest
way is to push a [settings file](settings.md) to `/etc/umap/umap.conf`.
