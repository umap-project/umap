from gzip import GzipFile

from django.core.exceptions import ImproperlyConfigured

try:
    from botocore.exceptions import ClientError
    from storages.backends.s3 import S3Storage
except ImportError:
    raise ImproperlyConfigured(
        "You need to install s3 dependencies: pip install umap-project[s3]"
    )


class S3DataStorage(S3Storage):
    gzip = True

    def get_reference_version(self, instance):
        metadata = self.connection.meta.client.head_object(
            Bucket=self.bucket_name, Key=instance.geojson.name
        )
        # Do not fail if bucket does not handle versioning
        return metadata.get("VersionId", metadata["ETag"])

    def make_filename(self, instance):
        return f"{str(instance.pk)}.geojson"

    def list_versions(self, instance):
        response = self.connection.meta.client.list_object_versions(
            Bucket=self.bucket_name, Prefix=instance.geojson.name
        )
        return [
            {
                "ref": version["VersionId"],
                "at": version["LastModified"].timestamp() * 1000,
                "size": version["Size"],
            }
            for version in response["Versions"]
        ]

    def get_version(self, ref, instance):
        try:
            data = self.connection.meta.client.get_object(
                Bucket=self.bucket_name,
                Key=instance.geojson.name,
                VersionId=ref,
            )
        except ClientError:
            raise ValueError(f"Invalid version reference: {ref}")
        return GzipFile(mode="r", fileobj=data["Body"]).read()

    def get_version_path(self, ref, instance):
        return self.url(instance.geojson.name, parameters={"VersionId": ref})

    def onDatalayerSave(self, instance):
        pass

    def onDatalayerDelete(self, instance):
        return self.connection.meta.client.delete_object(
            Bucket=self.bucket_name,
            Key=instance.geojson.name,
        )
