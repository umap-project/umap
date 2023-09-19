# Docker

There is now an official [uMap](https://hub.docker.com/r/umap/umap) image.

To run it with docker compose, create a `docker-compose.yml` like this:

_Sample docker-compose.yml_ 
```yaml
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
    image: umap/umap:1.3.7
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

next, create a basic settings file, named `umap.conf`` in the same directory. 

You can use this example below and it will run, but you may want to look at the project sample config, using `wget https://raw.githubusercontent.com/umap-project/umap/master/umap/settings/local.py.sample -O /etc/umap/umap.conf` and modify as needed. 

Make sure the settings in the docker-compose don't conflict with the sample config and vice-versa. In particular, remove the DATABASES section from the config file if useing the docker-compose file, or it will override the DATABASE_URL setting and things won't work. 

_Sample umap.conf_ 
```python 
"""                                                                                                                                                                                      
Example settings for docker quickstart: 
Lots of stuff has been removed for simplicity                                                                                                                                     
                                                                                                                                                                                         
See https://umap-project.readthedocs.io/en/master/settings/                                                                                                                              
                                                                                                                                                                                         
Things YOU need to change before launching:                                                                                                                                              
- modify SECRET_KEY                                                                                                                                                                      
"""

from umap.settings.base import *   # pylint: disable=W0614,W0401                                                                                                                         

SECRET_KEY = '!!secretsecret!!'
INTERNAL_IPS = ('127.0.0.1', )
ALLOWED_HOSTS = ['*', ]

DEBUG = True
COMPRESS_ENABLED = True
COMPRESS_OFFLINE = True
LANGUAGE_CODE = 'en'

# Set to False if login into django account should not be possible. You can                                                                                                              
# administer accounts in the admin interface.                                                                                                                                            
ENABLE_ACCOUNT_LOGIN = True
AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
)

# Enables a banner letting users know this site is not for production use                                                                                                                
UMAP_DEMO_SITE = True

# Whether to allow non authenticated people to create maps.                                                                                                                              
UMAP_ALLOW_ANONYMOUS = True
```

Some basic settings are available through env vars (see https://github.com/umap-project/umap/blob/master/umap/settings/base.py) and can be defined right in the docker-compose file,
but if you need more custom ones (like custom OAuth configuration), the easiest
way is to put them in a [settings file](settings.md) and mount it to `/etc/umap/umap.conf`.

---

#### Quick sidebar about docker and docker-compose
A multi-platform tutorial on [installing docker](https://docs.docker.com/get-docker/) and docker-compose is outside the scope of this howto, but if you are on a recent Ubuntu, this is all you need to install both:

```bash
sudo groupadd docker 
sudo snap install docker
sudo usermod -aG docker $USER
# EXIT and log back in to pickup the docker group membership, then test with
docker run hello-world
```

Current versions of docker compose are integrated into the docker command and launch with `docker compose` (two words) -- older versions use a separate binary named `docker-compose`. Either one will work for this. 

---

### Initial launch

Start the server with 
```bash
docker compose up
```
... and let it run some initial setup until the output quiesces with a message about spawning uWSGI workers. Because there is a race between the time the app tries to connect to the DB and when the DB is actually ready, you might see a few exceptions/erros about 'psychopg' being unable to connect. This should sort itself out as the app retries. 

### Create superuser

Now you need to create your site superuser. Stop the server (Ctrl-C) and then type:
```bash
docker-compose run app /venv/bin/umap createsuperuser` 
``````

Once that's done, you can relaunch your server with `docker compose up`

### Try It!

You should not ne able to brose to your uMap instance form a browser on your local system, by pointing your browser to ${SITE_URL} (see the docker-compose file, above.)

### Administration

To administer the site (add users, change map tiles, other customizations) log in as the root user you just created, then go to ${SITE_URL}/admin


