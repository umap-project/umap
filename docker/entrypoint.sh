#!/usr/bin/env bash
set -eo pipefail

source /venv/bin/activate

# then migrate the database
umap migrate
# then collect static files
umap collectstatic --noinput
# compress static files
umap compress
# run uWSGI
exec uwsgi --ini docker/uwsgi.ini
