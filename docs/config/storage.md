# Storage

uMap stores metadata (such as owner, permissions…) in PostgreSQL, and the data itself (the content of a layer)
in geojson format, by default on the local file system, but optionally in a S3 like server.

This can be configured through the `STORAGES` settings. uMap will use three keys:

- `default`, used only for the pictogram files, it can use whatever storage suits your needs
- `staticfiles`, used to store the static files, it can use whatever storage suits your needs,
  but by default uses a custom storage that will add hash to the filenames, to be sure they
  are not kept in any cache after a release
- `data`, used to store the layers data. This one should follow the uMap needs, and currently
  uMap provides only two options: `umap.storage.UmapFileSystem` and `umap.storage.UmapS3`

## Default settings:

This will use the file system for everything, including the data.

```
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "data": {
        "BACKEND": "umap.storage.UmapFileSystem",
    },
    "staticfiles": {
        "BACKEND": "umap.storage.UmapManifestStaticFilesStorage",
    },
}
```

## Using S3

To use an S3 like server for the layers data, the first thing is to install
the needed dependencies: `pip install umap-project[s3]`.

Then, change the `STORAGES` settings with something like this:

```
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "data": {
        "BACKEND": "umap.storage.UmapS3",
        "OPTIONS": {
            "access_key": "xxx",
            "secret_key": "yyy",
            "bucket_name": "umap",
            "region_name": "eu",
            "endpoint_url": "http://127.0.0.1:9000",
        },
    },
    "staticfiles": {
        "BACKEND": "umap.storage.UmapManifestStaticFilesStorage",
    },
}
```

See more about the configuration on the [django-storages documentation](https://django-storages.readthedocs.io/en/latest/backends/amazon-S3.html).
