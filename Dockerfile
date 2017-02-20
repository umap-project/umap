FROM python:3.5

ENV PYTHONUNBUFFERED=1 \
    UMAP_SETTINGS=/srv/umap/umap/settings/docker.py \
    PORT=8000

# create a user account and group to run uMap
RUN mkdir -p /srv/umap/{data,uploads} && \
    chown -R 10001:10001 /srv/umap && \
    groupadd --gid 10001 umap && \
    useradd --no-create-home --uid 10001 --gid 10001 --home-dir /srv/umap umap

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        apt-transport-https \
        binutils \
        libproj-dev \
        gdal-bin \
        build-essential \
        curl \
        git \
        libpq-dev \
        postgresql-client \
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
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Add Tini
ENV TINI_VERSION v0.14.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini

COPY . /srv/umap

WORKDIR /srv/umap

RUN pip install --no-cache .[docker]

USER umap

EXPOSE 8000

ENTRYPOINT ["/tini", "--"]

CMD ["/srv/umap/docker-entrypoint.sh"]
