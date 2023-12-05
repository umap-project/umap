# Configuring Nginx

Here are some configuration files to use umap with nginx and [uWSGI](https://uwsgi-docs.readthedocs.io/en/latest/), a server for python, which will handle your processes for you.

```nginx title="nginx.conf"
upstream umap {
    server unix:///srv/umap/uwsgi.sock;
}

server {
    # the port your site will be served on
    listen      80;
    listen   [::]:80;
    listen      443 ssl;
    listen   [::]:443 ssl;
    # the domain name it will serve for
    server_name your-domain.org;
    charset     utf-8;

    # max upload size
    client_max_body_size 5M;   # adjust to taste

    # Finally, send all non-media requests to the Django server.
    location / {
        uwsgi_pass  umap;
        include /srv/umap/uwsgi_params;
    }
}
```

## uWSGI


```nginx title="uwsgi_params"
uwsgi_param  QUERY_STRING       $query_string;
uwsgi_param  REQUEST_METHOD     $request_method;
uwsgi_param  CONTENT_TYPE       $content_type;
uwsgi_param  CONTENT_LENGTH     $content_length;

uwsgi_param  REQUEST_URI        $request_uri;
uwsgi_param  PATH_INFO          $document_uri;
uwsgi_param  DOCUMENT_ROOT      $document_root;
uwsgi_param  SERVER_PROTOCOL    $server_protocol;
uwsgi_param  REQUEST_SCHEME     $scheme;
uwsgi_param  HTTPS              $https if_not_empty;

uwsgi_param  REMOTE_ADDR        $remote_addr;
uwsgi_param  REMOTE_PORT        $remote_port;
uwsgi_param  SERVER_PORT        $server_port;
uwsgi_param  SERVER_NAME        $server_name;
```


```ini title="uwsgi.ini"
[uwsgi]
uid = umap
gid = users
# Python related settings
# the base directory (full path)
chdir = /srv/umap/
# umap's wsgi module
module = umap.wsgi
# the virtualenv (full path)
home = /srv/umap/venv

# process-related settings
# master
master = true
# maximum number of worker processes
processes = 4
# the socket (use the full path to be safe)
socket = /srv/umap/uwsgi.sock
# ... with appropriate permissions - may be needed
chmod-socket = 666
stats = /srv/umap/stats.sock
# clear environment on exit
vacuum = true
plugins = python3
```

## Static files

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
        alias /path/to/umap/var/data/;
    }
```
