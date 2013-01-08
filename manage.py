#!/usr/bin/env python
import os
import sys

# SeSQL look for "sesql_config" in the sys.path...
# FIXME: PR to SeSQL to be able to define the import path
# with an env var
sys.path.insert(0, os.path.abspath('umap'))

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE",
        "umap.settings.local")

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
