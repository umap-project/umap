YouMap project
==============

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
