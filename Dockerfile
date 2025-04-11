# This part installs deps needed at runtime.
FROM python:3.12-slim AS common

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        tini \
        sqlite3 \
        libpq-dev \
        gdal-bin \
        && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# This part adds deps needed only at buildtime.
FROM common AS build

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        binutils \
        libproj-dev \
        curl \
        git \
        gettext \
        python3-venv \
        libffi-dev \
        libtiff5-dev \
        libjpeg62-turbo-dev \
        zlib1g-dev \
        libfreetype6-dev \
        liblcms2-dev \
        libwebp-dev

RUN python -m venv /venv

WORKDIR /srv/umap

COPY . /srv/umap

RUN /venv/bin/pip install .[docker,s3,sync]

FROM common

COPY --from=build /srv/umap/docker/ /srv/umap/docker/
COPY --from=build /venv/ /venv/

WORKDIR /srv/umap

RUN mkdir -p /srv/umap/uploads

ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    PATH="/venv/bin:$PATH"

EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["/srv/umap/docker/entrypoint.sh"]
