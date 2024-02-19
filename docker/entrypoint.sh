#!/usr/bin/env bash
set -eo pipefail

source /venv/bin/activate

# collect static files
umap collectstatic --noinput
# now wait for the database
umap wait_for_database
# then migrate the database
umap migrate
# run uWSGI
exec uwsgi --ini docker/uwsgi.ini
