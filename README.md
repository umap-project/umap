
# uMap project

[![Requirements Status](https://requires.io/github/umap-project/umap/requirements.svg?branch=master)](https://requires.io/github/umap-project/umap/requirements/?branch=master)
[![Join the chat at https://gitter.im/umap-project/umap](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/umap-project/umap?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## About

uMap lets you create maps with OpenStreetMap layers in a minute and embed them in your site.
*Because we think that the more OSM will be used, the more OSM will be ''cured''.*
It uses [django-leaflet-storage](https://github.com/umap-project/django-leaflet-storage) and [Leaflet.Storage](https://github.com/umap-project/Leaflet.Storage),  built on top of Django and Leaflet.


## Quickstart

Create a geo aware database. See [Geodjango doc](https://docs.djangoproject.com/en/dev/ref/contrib/gis/install/) for backend installation.

Create a virtual environment

    virtualenv umap
    source umap/bin/activate

Install dependencies and project

    cd YOUR_SOURCE_DIR
    git clone git@github.com:umap-project/umap.git
    cd umap
    pip install -r requirements.txt
    pip install -e .

Create a default local settings file

    cp umap/settings/local.py.sample umap/settings/local.py

Add database connexion informations in `local.py`, for example

    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': 'umap',
        }
    }

Add a `SECRET_KEY` in `local.py` with a long random secret key

    SECRET_KEY = "a long and random secret key that must not be shared"

uMap uses [django-social-auth](http://django-social-auth.readthedocs.org/) for user authentication. So you will need to configure it according to your
needs. For example

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

Example of callback URL to use for setting up OAuth apps

 http://umap.foo.bar/complete/github/

Adapt the `STATIC_ROOT` and `MEDIA_ROOT` to your local environment.

Create the tables

    python manage.py migrate

Collect and compress the statics

    python manage.py collectstatic
    python manage.py compress

Add a site object

    python manage.py shell
    from django.contrib.sites.models import Site
    Site.objects.create(name='example.com', domain='example.com')

Start the server

    python manage.py runserver 0.0.0.0:8000

Go to the admin (http://localhost:8000/admin/) and add:

- at least one license
- at least one tile layer

## Search

UMap uses Postgresql tsvector for searching. It case your database is big, you
may want to add an index. For that, you sould do so:

    CREATE EXTENSION unaccent;
    CREATE EXTENSION btree_gin;
    ALTER FUNCTION unaccent(text) IMMUTABLE;
    ALTER FUNCTION to_tsvector(text) IMMUTABLE;
    CREATE INDEX search_idx ON leaflet_storage_map USING gin(to_tsvector(unaccent(name)), share_status);

## Translating

Everything is managed through Transifex: https://www.transifex.com/projects/p/umap/
