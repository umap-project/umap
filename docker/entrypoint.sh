#!/usr/bin/env bash
set -eo pipefail

source /venv/bin/activate

# collect static files
umap collectstatic --noinput
# now wait for the database
umap wait_for_database
# then migrate the database
umap migrate
# run the server
exec uvicorn --proxy-headers --no-access-log --host 0.0.0.0 umap.asgi:application
