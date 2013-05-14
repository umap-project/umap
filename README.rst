uMap project
==============

About
-----
uMap let you create map with OpenStreetMap layers in a minute and embed them in your site.
*Be cause we think that the more OSM will be used, the more OSM will be ''cured''.*
It uses `django-leaflet-storage <https://github.com/yohanboniface/django-leaflet-storage>`_ and `Leaflet.Storage <https://github.com/yohanboniface/Leaflet.Storage>`_,  built on top of Django and Leaflet.


Quickstart
----------

Create a geo aware database. See `Geodjango doc <https://docs.djangoproject.com/en/dev/ref/contrib/gis/install/>`_ for backend installation.

Create a virtualenv::

    mkvirtualenv umap

Install dependencies and project::

    cd path/to/umap/repository
    pip install -r requirements.pip
    pip install -e .

Create a default local settings file::

    touch umap/settings/local.py

Import base settings::

    from umap.settings.base import *

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


Create the tables::

    python manage.py syncdb --migrate

Collect and compress the statics::

    python manage.py collectstatic
    python manage.py compress

Start the server::

    python manage.py runserver 0.0.0.0:8000

Go to the admin (http://localhost:8000/admin/) and add:

- almost one licence
- almost one tilelayer

Translating
-----------

For translating uMap in a new language, three repositories must be taken into account:

- this current one
- `Leaflet.Storage <https://github.com/yohanboniface/Leaflet.Storage>`_
- `django-leaflet-storage <https://github.com/yohanboniface/django-leaflet-storage>`_

**If you are not comfortable with python and/or git, you can fill an issue for me to
create the needed files.**

For this repository and django-leaflet-storage, here are the steps:

- go to the root of the python module (for example `umap/umap` in this case)
- run `django-admin.py makemessages -l fr` using your language code instead of `fr`
- translate what's needed in the ad hoc file in the `locale` repository (for example `umap/umap/locale/fr/LC_MESSAGES/django.po`)
- from the root of the python module, run `django-admin.py compilemessages`
- commit, push, PR :)

For Leaflet.Storage, here are the steps:

- add your language in `bin/i18n.js`
- run `node bin/i18n.js`
- update the dedicated file in the `src/locale` repository
- commit, push, PR :)