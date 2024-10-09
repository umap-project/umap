# Docker

An official uMap docker image is [available on the docker hub](https://hub.docker.com/r/umap/umap). But, if you prefer to run it with docker compose, here is the configuration file:

```yaml title="docker-compose.yml"
--8<-- "./docker-compose.yml"
```

Note that you’ll have to set a [`SECRET_KEY`](https://docs.djangoproject.com/en/5.0/ref/settings/#secret-key) environment variable that must be secret and unique. One way to generate it is through the `secrets` module from Python:

```sh
$ python3 -c 'import secrets; print(secrets.token_hex(100))'
```

User accounts can be managed via the Django admin page ({SITE_URL}/admin). The required superuser must be created on the container command line with this command:
```bash
umap createsuperuser
```
