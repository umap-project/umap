# Installation

*Note: for Ubuntu follow procedure [Ubuntu from scratch](ubuntu.md)*

*Note: for a Windows installation follow procedure [Installing on Windows](install_windows.md)*

Create a geo aware database. See [Geodjango doc](https://docs.djangoproject.com/en/dev/ref/contrib/gis/install/) for backend installation.

Create a virtual environment

    virtualenv umap
    source umap/bin/activate

Install dependencies and project

    pip install umap-project

Create a default local settings file

    wget https://raw.githubusercontent.com/umap-project/umap/master/umap/settings/local.py.sample -O local.py


Reference it as env var:

    export UMAP_SETTINGS=`pwd`/local.py


Add database connection information in `local.py`, for example

    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': 'umap',
        }
    }

Add a `SECRET_KEY` in `local.py` with a long random secret key

    SECRET_KEY = "a long and random secret key that must not be shared"

uMap uses [python-social-auth](http://python-social-auth.readthedocs.org/) for user authentication. So you will need to configure it according to your
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

    umap migrate

Collect and compress the statics

    umap collectstatic
    umap compress

Create a superuser

    umap createsuperuser

Start the server

    umap runserver 0.0.0.0:8000

## Search

UMap uses PostgreSQL tsvector for searching. In case your database is big, you
may want to add an index. For that, you should do so:

    CREATE EXTENSION unaccent;
    CREATE EXTENSION btree_gin;
    ALTER FUNCTION unaccent(text) IMMUTABLE;
    ALTER FUNCTION to_tsvector(text) IMMUTABLE;
    CREATE INDEX search_idx ON umap_map USING gin(to_tsvector(unaccent(name)), share_status);


## Optimisations

To speed up uMap homepage rendering on a large instance, the following index can be added as well (make sure you set the center to your default instance map center):

    CREATE INDEX umap_map_optim ON umap_map (modified_at) WHERE ("umap_map"."share_status" = 1 AND ST_Distance("umap_map"."center", ST_GeomFromEWKT('SRID=4326;POINT(2 51)')) > 1000.0);
