#!/usr/bin/env bash
set -eo pipefail

source /venv/bin/activate
service redis-server start

# collect static files
umap collectstatic --noinput
# now wait for the database
umap wait_for_database
# then migrate the database
umap migrate
# run the server
exec uvicorn --proxy-headers --no-access-log umap.asgi:application
