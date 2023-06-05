#!/usr/bin/env bash
set -eo pipefail

source /venv/bin/activate

# default variables
: "${SLEEP:=1}"
: "${TRIES:=60}"

function wait_for_database {(
  echo "Waiting for database to respond..."
  tries=0
  while true; do
    [[ $tries -lt $TRIES ]] || return
    (echo "from django.db import connection; connection.connect()" | umap shell) >/dev/null
    [[ $? -eq 0 ]] && return
    sleep $SLEEP
    tries=$((tries + 1))
  done
)}

# first wait for the database
wait_for_database
# then migrate the database
umap migrate
# then collect static files
umap collectstatic --noinput
# compress static files
umap compress
# run uWSGI
exec uwsgi --ini docker/uwsgi.ini
