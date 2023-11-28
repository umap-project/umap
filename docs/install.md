# Installation

!!! info "Specific guides"

    This page covers how to get started with uMap. If you plan on deploying the service on a server for other people to consume, you can follow different tutorials:

    - [Deploying uMap on Ubuntu](deploy/ubuntu.md) (from scratch)
    - [Deploying uMap using Docker](deploy/docker.md)
    - Recent Windows distribution provide [WSL 2](https://learn.microsoft.com/en-us/windows/wsl/install), which makes it possible to run a Linux distribution of your choice.

## System dependencies

uMap is built with the [Python](https://python.org) language, and the [Django](https://djangoproject.com) framework. It needs a [PostgreSQL](https://www.postgresql.org/) database, with the [Postgis](https://postgis.net/) extension enabled.

Here are the commands to install the required system dependencies.

=== "Debian"
    
    ```bash
    sudo apt update
    sudo apt install python3 python3-dev python3-venv virtualenv postgresql gcc postgis libpq-dev
    ``` 

=== "Arch Linux"
    ```bash
    yay postgis extra/postgresql-libs
    ```

=== "OS X (with brew)"

    ```bash
    brew install postgis
    ```

=== "Fedora"

    ```bash
    sudo dnf install postgis libpq-devel make gcc python3-devel
    ```

### PostgreSQL

Depending on your system, you might need to create a postgres user, the database, and initialize postgres. Here's how:

```bash
createuser umap -U postgres
createdb umap -O umap -U postgres
psql umap -c "CREATE EXTENSION postgis" -Upostgres
```

## Getting started

Create a geo aware database. See the [GeoDjango docs](https://docs.djangoproject.com/en/dev/ref/contrib/gis/install/) for backend installation.

### Creating a virtual environment 

It is recommended to install python projects in a virtual environment to avoid mixing the project installation with your system dependencies. But it's not a requirement and it is up to you 🫣

```bash
python -m venv venv
source venv/bin/activate
```

### Installing the dependencies

You can get all the project dependencies installed with the following command:

```bash
pip install umap-project
```

### Configuration

Create a default `local_settings.py` file, that you will modify with your setting.

```bash
wget https://raw.githubusercontent.com/umap-project/umap/master/umap/settings/local.py.sample -O local_settings.py
```

Reference it as env var:

```bash
export UMAP_SETTINGS=`pwd`/local_settings.py
```

Add database connection information in `local_settings.py`, for example

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'umap',
    }
}
```

Depending on your installation, you might need to change the user that connects the database.

It should look like this:

```python
DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": "umap",
        "USER": "postgres",
    }
}
```

Add a `SECRET_KEY` in `local_settings.py` with a long random secret key

```python
SECRET_KEY = "a long and random secret key that must not be shared"
```

You can easily generate one with [openssl](https://www.openssl.org/):

```bash
openssl rand -base64 32
```

uMap uses [python-social-auth](http://python-social-auth.readthedocs.org/) for user authentication. So you will need to configure it according to your needs. For example

```python
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
```

Example of callback URL to use for setting up OAuth apps

http://umap.foo.bar/complete/github/

Adapt the `STATIC_ROOT` and `MEDIA_ROOT` to your local environment.

## Bootstrapping the database

Here are the commands you'll need to run to create the tables, collect the static files, etc.

```bash
# Create the database tables
umap migrate

# Collect and compress static files
umap collectstatic
umap compress

# Create a super user
umap createsuperuser

# Finally start the server
umap runserver 0.0.0.0:8000
```

## Configuring PostgreSQL search

UMap uses PostgreSQL tsvector for searching. In case your database is big, you
may want to add an index. For that, here are the SQL commands to run:

```SQL
# Create a basic search configuration
CREATE TEXT SEARCH CONFIGURATION umapdict (COPY=simple);

# If you also want to deal with accents and case, add this before creating the index
CREATE EXTENSION unaccent;
CREATE EXTENSION btree_gin;
ALTER TEXT SEARCH CONFIGURATION umapdict ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;

# Now create the index
CREATE INDEX IF NOT EXISTS search_idx ON umap_map USING GIN(to_tsvector('umapdict', COALESCE(name, ''::character varying)::text), share_status);
```

And change your settings:

```python
UMAP_SEARCH_CONFIGURATION = "umapdict"
```

## Configuring emails

UMap can send the anonymous edit link by email. For this to work, you need to
add email specific settings. See [Django](https://docs.djangoproject.com/en/4.2/topics/email/#smtp-backend)
documentation.

In general, you'll need to add something like this in your local settings:

```python
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

## Upgrading your installation

Usually, for upgrading, you need those steps:

```bash
pip install umap-project --upgrade
umap migrate
umap collectstatic
umap compress
```

Then you need to restart your python server, for example:

```bash
sudo systemctl restart uwsgi  # or gunicorn, or…
```
