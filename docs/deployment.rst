Deployment
==========

Staging/Development
-------------------

`Fabric <http://pypi.python.org/pypi/Fabric>`_ is used to allow developers to
easily push changes to a previously setup development/staging environment.
To get started, install Fabric by running the following command from within
your virtual environment::

    pip install fabric==1.4

So see a list of available commands, run the following command from within your
project directory::

    fab -l

Some common commands::

    fab restart       # Restart the web server.
    fab update        # Just update the repository.
    fab push deploy   # Push, then fully deploy.

From the within the project directory, you can just run ``fab [command]``.
If you want to run fabric outside of the directory, use::

	fab --fabfile /path/to/project/fabfile.py [command]
