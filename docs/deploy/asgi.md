# ASGI

While uMap has been historically deployed using the WSGI specification,
there is now an **experimental** ASGI endpoint. This will be the way to
deploy uMap to use the live collaborative editing feature, which needs
websockets.

## Nginx

When using ASGI, the [nginx](nginx.md), the `/` entrypoint should be:

```
location / {
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_redirect off;
    proxy_buffering off;
    proxy_pass http://umap/;
}
```

## Uvicorn

Uvicorn must be installed in the umap virtualenv:

    /path/to/umap/venv/bin/pip install uvicorn

And could then be run like this:

    /path/to/umap/venv/bin/uvicorn \
    --proxy-headers \
    --uds /srv/umap/umap.sock \
    --no-access-log \
    umap.asgi:application

## Systemd

Here is an example service to manage uvicorn with systemd:

```
[Unit]
Description=umap
After=network.target
Requires=postgresql.service

[Service]
Type=simple
User=umap

WorkingDirectory=/srv/umap/
PrivateTmp=true

EnvironmentFile=/srv/umap/env

ExecStart=/srv/umap/venv/bin/uvicorn \
    --proxy-headers \
    --uds /srv/umap/uvicorn.sock \
    --no-access-log \
    umap.asgi:application
ExecReload=/bin/kill -HUP ${MAINPID}
RestartSec=1
Restart=always

[Install]
WantedBy=multi-user.target
```

Then to install it and enable it, copy it to `/etc/systemd/system/umap.service`
and run:

    sudo systemctl enable umap.service

## Env

Uvicorn can be [configured](https://www.uvicorn.org/deployment/) from env vars,
for example to define the number of workers:

```env title="/srv/umap/env"
UVICORN_WORKERS=4
```
