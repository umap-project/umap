YouMap project
==============

About
-----
YouMap let you create map with OpenStreetMap layers in a minute and embed them in your site.
*Be cause we think that the more OSM will be used, the more OSM will be ''cured''.*
It uses django-chickpea, built on top of Django and Leaflet


Quickstart
----------

To bootstrap the project::

    virtualenv youmap
    source youmap/bin/activate
    cd path/to/youmap/repository
    pip install -r requirements.pip
    pip install -e .
    cp youmap/settings/local.py.example youmap/settings/local.py
    manage.py syncdb --migrate

Documentation
-------------

Developer documentation is available in Sphinx format in the docs directory.

Initial installation instructions (including how to build the documentation as
HTML) can be found in docs/install.rst.
