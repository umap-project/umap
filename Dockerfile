FROM node:18 AS vendors

COPY . /srv/app

WORKDIR /srv/app

RUN make installjs
RUN make vendors

FROM python:3.8-slim as app_python

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        tini \
        uwsgi \
        libpq-dev \
        build-essential \
        binutils \
        gdal-bin \
        libproj-dev \
        curl \
        git \
        gettext \
        sqlite3 \
        libffi-dev \
        libtiff5-dev \
        libjpeg62-turbo-dev \
        zlib1g-dev \
        libfreetype6-dev \
        liblcms2-dev \
        libwebp-dev

ENV PYTHONUNBUFFERED=1 \
    UMAP_SETTINGS=/srv/app/umap/settings/docker.py \
    PORT=8000

COPY . /srv/app
RUN mkdir -p /srv/app/data && \
    mkdir -p /srv/app/uploads
COPY --from=vendors /srv/app/umap/static/umap/vendors /srv/app/umap/static/umap/vendors

WORKDIR /srv/app

RUN pip install --no-cache -r requirements-docker.txt && pip install .
RUN apt-get remove -y \
        binutils \
        libproj-dev \
        libffi-dev \
        libtiff5-dev \
        libjpeg62-turbo-dev \
        zlib1g-dev \
        libfreetype6-dev \
        liblcms2-dev \
        libwebp-dev \
        && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["/srv/app/docker-entrypoint.sh"]

FROM app_python as app_python_debug

WORKDIR /srv/app

RUN pip install debugpy==1.6.7
