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

Add database connexion informations in `local.py`, for example::

    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': 'umap',
        }
    }

Create the tables::

    python manage.py syncdb

Start the server::

    python manage.py runserver 0.0.0.0:8000
