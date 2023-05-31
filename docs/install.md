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

    # Create a basic search configuration
    CREATE TEXT SEARCH CONFIGURATION umapdict (COPY=simple);

    # If you also want to deal with accents and case, add this before creating the index
    CREATE EXTENSION unaccent;
    CREATE EXTENSION btree_gin;
    ALTER TEXT SEARCH CONFIGURATION umapdict ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;

    # Now create the index
    CREATE INDEX IF NOT EXISTS search_idx ON umap_map USING GIN(to_tsvector('umapdict', name), share_status);

And change `UMAP_SEARCH_CONFIGURATION = "umapdict"` in your settings.


## Emails

UMap can send the anonymous edit link by email. For this to work, you need to
add email specific settings. See [Django](https://docs.djangoproject.com/en/4.2/topics/email/#smtp-backend)
documentation.

In general, you'll need to add something like this in your local settings:

```
FROM_EMAIL = "youradmin@email.org"
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.provider.org"
EMAIL_PORT = 456
EMAIL_HOST_USER = "username"
EMAIL_HOST_PASSWORD = "xxxx"
EMAIL_USE_TLS = True
# or
EMAIL_USE_SSL = True
```
