# Synology 

These instructions only serve as a start and based on DSM 7.2. The following pages serve as a basis and should be observed:
- https://docs.umap-project.org/en/master/deploy/docker/
- https://docs.umap-project.org/en/master/config/settings

## Preparation:
- create a key that will later be used as SECRET_KEY (= "a long and random secret key that must not be shared"
  You can easily generate one with openssl at command line with: `openssl rand -base64 32`)
- Under which web address should uMap be called? It must be assigned to the environment variable SITE_URL and specified in the reverse proxy. In this description https://map.example.com is used

<hr>   

### 1. Paths:   
Create the following folders in the FileStation (there may also be different paths, but these must also be adjusted in the configuration below):
`/volume1/docker/umap/POSTGRESQL_DATA`
`/volume1/docker/umap/STATIC_ROOT`
`/volume1/docker/umap/MEDIA_ROOT`
`/volume1/docker/umap/conf`


<hr>   

### 2. Config:
Create the configuration file and save it here (I recommend the DSM text editor from the package centre):
- /volume1/docker/umap/conf/umap.conf
<details>
  <summary>example config (click) - you still need to customise them:</summary>
  
```  
# ➜ https://docs.umap-project.org/en/master/config/settings
#[general]
# Site name
title = "My uMap"
# Site URL
site_url = "https://map.example.com/"
# Site description
description = "My uMap description"
# Site logo (optional)
logo = "/static/umap.png"
# Site favicon (optional)
# favicon = "/static/favicon.ico"

# Default language
language = "de"
# Default map center
default_latitude = "49.90305"
default_longitude = "15.77054"
default_zoom = "16"
# Map background
background_layer = "osm"
# Map tile server
tile_layer = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
# Map attribution
attribution = "© OpenStreetMap contributors"
SECRET_KEY = "1234"
#
# Do you want users to be able to create an account directly on your uMap instance (instead of only using OAuth).
# You need to create first a superuser, on the command line (open Terminal in Container Manager):
# > umap createsuperuser
#   umapadmin
#   umap@map.example.com
#   YOURPASSWORD
#
ENABLE_ACCOUNT_LOGIN=1
#
# To log in as the first user, you must set the UMAP_REGISTRATION_OPEN option to True. 
# This allows you to create a new account that is automatically considered a superuser. 
# After you have registered, you can set the option to False again to prevent further registrations. 
# Alternatively, you can also create a superuser account via the Django admin interface.
UMAP_REGISTRATION_OPEN = True
```   

  
</details>

<hr>   

### 3. Reverse Proxy = (Direct your uMap domain to your uMap Docker container):
- '_Control Panel_' ➜ '_Login Portal_' ➜ Tab '_Advanced_' ➜ '_Reverse Proxy_' and adjust like this:
![reverse_proxy](https://github.com/umap-project/umap/assets/29315520/b48eefb3-2b95-495f-8140-209bf66b1b76)


- Open the Firewall for Port 443
- forward Port 443 in your Router to your DiskStation


<hr>   

### 4. Container Manager (formerly package 'Docker'):
open '_Container Manager_' ➜ go to '_Project_' ➜ '_create_'
- define a project name
- select yout project path (/volume1/docker/umap/)
- select 'Create docker-compose.yaml' and paste this code into (adjust environment variables `SITE_URL`, `SECRET_KEY` and volume mounts [for db & app]):

```   
version: '3'
services:
  db:
    image: postgis/postgis:14-3.4-alpine
    environment:
      - POSTGRES_HOST_AUTH_METHOD=trust
    volumes:
      - /volume1/docker/umap/POSTGRESQL_DATA:/var/lib/postgresql/data

  app:
    image: umap/umap:2.3.1
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgis://postgres@db/postgres
      - SITE_URL=https://map.example.com/
      - STATIC_ROOT=/srv/umap/static
      - MEDIA_ROOT=/srv/umap/uploads
      - SECRET_KEY=1234
    volumes:
#     # FIX the path on the left, below, to your location 
      - /volume1/docker/umap/conf/umap.conf:/etc/umap/umap.conf
      - /volume1/docker/umap/STATIC_ROOT:/srv/umap/static
      - /volume1/docker/umap/MEDIA_ROOT:/srv/umap/uploads
    restart: always
    depends_on:
      - db
```   
- now 'create' your project

<hr>   

### 5. create superuser:
Do you want users to be able to create an account directly on your uMap instance (instead of only using OAuth).
You need to [create first a superuser](https://docs.umap-project.org/en/master/config/settings/#enable_account_login), on the command line (open Terminal in Container Manager):
```  
umap createsuperuser
#   umapadmin
#   umap@map.example.com
#   YOURPASSWORD
```  

