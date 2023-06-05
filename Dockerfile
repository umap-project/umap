FROM node:alpine AS vendors

COPY . /srv/umap

WORKDIR /srv/umap

RUN npm install

RUN npm run vendors

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=8000

RUN mkdir -p /srv/umap/uploads

COPY . /srv/umap

COPY --from=vendors /srv/umap/umap/static/umap/vendors /srv/umap/umap/static/umap/vendors

WORKDIR /srv/umap

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
        libwebp-dev \
        && \
    pip install .[docker] && \
    apt-get remove -y \
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

CMD ["/srv/umap/docker/entrypoint.sh"]
