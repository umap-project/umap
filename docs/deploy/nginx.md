# Configuring Nginx

See [WSGI](wsgi.md) or [ASGI](asgi.md) for a basic setup.

Then consider adding this configuration

## Static files and geojson

```nginx title="nginx.conf"
location /static {
    autoindex off;
    access_log off;
    log_not_found off;
    sendfile on;
    gzip on;
    gzip_vary on;
    alias /path/to/umap/var/static/;   
}

location /uploads {
    autoindex off;
    sendfile on;
    gzip on;
    gzip_vary on;
    alias /path/to/umap/var/data/;
    # Exclude direct access to geojson, as permissions must be
    # checked py django.
    location /uploads/datalayer/ { return 404; }
}
```

## X-Accel-Redirect

With this configuration, NGINX will directly serve the geoJSON layers, but uMap will check the permissions.

```title="umap.conf"
UMAP_XSENDFILE_HEADER = 'X-Accel-Redirect'
```

```title="nginx.conf"
    location /internal/ {
        internal;
        gzip_vary on;
        gzip_static on;
        # Next line is very important!
        add_header X-DataLayer-Version $upstream_http_x_datalayer_version;
        alias /path/to/umap/var/data/;
    }
```
