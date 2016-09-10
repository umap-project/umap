import imp
import os
import sys

from django.utils.termcolors import colorize

from .base import *  # NOQA, default values

# Allow to override setting from any file, may be out of the PYTHONPATH,
# to make it easier for non python people.
path = os.environ.get('UMAP_SETTINGS')
if path:
    d = imp.new_module('config')
    d.__file__ = path
    try:
        with open(path) as config_file:
            exec(compile(config_file.read(), path, 'exec'), d.__dict__)
    except IOError as e:
        msg = 'Unable to import {} from UMAP_SETTINGS'.format(path)
        print(colorize(msg, fg='red'))
        sys.exit(e)
    else:
        print('Loaded local config from', path)
        for key in dir(d):
            if key.isupper():
                globals()[key] = getattr(d, key)
else:
    # Retrocompat
    try:
        from .local import *  # NOQA
    except ImportError:
        pass
