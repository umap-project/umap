uMap project
==============

About
-----
uMap lets you create maps with OpenStreetMap layers in a minute and embed them in your site.
*Because we think that the more OSM will be used, the more OSM will be ''cured''.*
It uses `django-leaflet-storage <https://github.com/yohanboniface/django-leaflet-storage>`_ and `Leaflet.Storage <https://github.com/yohanboniface/Leaflet.Storage>`_,  built on top of Django and Leaflet.


Quickstart
----------

Create a geo aware database. See `Geodjango doc <https://docs.djangoproject.com/en/dev/ref/contrib/gis/install/>`_ for backend installation.

Create a virtualenv::

    mkvirtualenv umap

Install dependencies and project::

    cd path/to/umap/repository
    git checkout 0.3.x
    git submodule init
    pip install -r requirements.pip
    pip install -e .

Configure stopwords for SeSQL in running this `script <https://bitbucket.org/liberation/sesql/raw/d13763736f3db098127089bce2e66b1be122007a/scripts/generate_stop.sh`>_:

    wget https://bitbucket.org/liberation/sesql/raw/d13763736f3db098127089bce2e66b1be122007a/scripts/generate_stop.sh
    chmod +x generate_stop.sh
    sudo generate_stop.sh

Create a default local settings file::

    cp umap/settings/local.py.sample umap/settings/local.py

Add database connexion informations in `local.py`, for example::

    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': 'umap',
        }
    }

Add a `SECRET_KEY` in `local.py` with a long random secret key::

    SECRET_KEY = "a long and random secret key that must not be shared"

uMap uses `django-social-auth <http://django-social-auth.readthedocs.org/>`_ for user authentication. So you will need to configure it according to your
needs. For example::

    AUTHENTICATION_BACKENDS = (
        'social_auth.backends.contrib.github.GithubBackend',
        'social_auth.backends.contrib.bitbucket.BitbucketBackend',
        'social_auth.backends.twitter.TwitterBackend',
        'django.contrib.auth.backends.ModelBackend',
    )
    GITHUB_APP_ID = 'xxx'
    GITHUB_API_SECRET = 'zzz'
    BITBUCKET_CONSUMER_KEY = 'xxx'
    BITBUCKET_CONSUMER_SECRET = 'zzz'
    TWITTER_CONSUMER_KEY = "xxx"
    TWITTER_CONSUMER_SECRET = "yyy"

Example of callback URL to use for settings up OAuth apps::

 http://umap.foo.bar/complete/github/

Create the tables::

    python manage.py syncdb --migrate

Collect and compress the statics::

    python manage.py collectstatic
    python manage.py compress

Start the server::

    python manage.py runserver 0.0.0.0:8000

Go to the admin (http://localhost:8000/admin/) and add:

- almost one license
- almost one tilelayer

Translating
-----------

Everything is managed through Transifex: https://www.transifex.com/projects/p/umap/