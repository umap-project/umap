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
    # Exclude direct acces to geojson, as permissions must be
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

## Ajax proxy

In order for users to load CORS protected data within a map, Nginx can act as a proxy.
Here is an example configuration for this:

```

location ~ ^/proxy/(.*) {
    internal;
    add_header X-Proxy-Cache $upstream_cache_status always;
    proxy_cache_background_update on;
    proxy_cache_use_stale updating;
    proxy_cache ajax_proxy;
    proxy_cache_valid 1m;  # Default. Umap will override using X-Accel-Expires
    set $target_url $1;
    # URL is encoded, so we need a few hack to clean it back.
    if ( $target_url ~ (.+)%3A%2F%2F(.+) ){ # fix :// between scheme and destination
      set $target_url $1://$2;
    }
    if ( $target_url ~ (.+?)%3A(.*) ){ # fix : between destination and port
      set $target_url $1:$2;
    }
    if ( $target_url ~ (.+?)%2F(.*) ){ # fix / after port, the rest will be decoded by proxy_pass
      set $target_url $1/$2;
    }
    resolver 8.8.8.8;
    add_header X-Proxy-Target $target_url; # For debugging
    proxy_pass_request_headers off;
    proxy_set_header Content-Type $http_content_type;
    proxy_set_header Content-Encoding $http_content_encoding;
    proxy_set_header Content-Length $http_content_length;
    proxy_read_timeout 10s;
    proxy_connect_timeout 5s;
    proxy_ssl_server_name on;
    proxy_pass $target_url;
    proxy_intercept_errors on;
    error_page 301 302 307 = @handle_proxy_redirect;
}
location @handle_proxy_redirect {
    resolver 8.8.8.8;
    set $saved_redirect_location '$upstream_http_location';
    proxy_pass $saved_redirect_location;
}
```
