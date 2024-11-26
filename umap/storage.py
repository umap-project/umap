import operator
import os
import shutil
import time
from pathlib import Path

from botocore.exceptions import ClientError
from django.conf import settings
from django.contrib.staticfiles.storage import ManifestStaticFilesStorage
from django.core.files.storage import FileSystemStorage
from rcssmin import cssmin
from rjsmin import jsmin
from storages.backends.s3 import S3Storage


class UmapManifestStaticFilesStorage(ManifestStaticFilesStorage):
    support_js_module_import_aggregation = True
    max_post_process_passes = 15

    # We remove `;` at the end of all regexps to match our biome config.
    _js_module_import_aggregation_patterns = (
        "*.js",
        (
            (
                (
                    r"""(?P<matched>import(?s:(?P<import>[\s\{].*?))"""
                    r"""\s*from\s*['"](?P<url>[\.\/].*?)["']\s*)"""
                ),
                'import%(import)s from "%(url)s"\n',
            ),
            (
                (
                    r"""(?P<matched>export(?s:(?P<exports>[\s\{].*?))"""
                    r"""\s*from\s*["'](?P<url>[\.\/].*?)["']\s*)"""
                ),
                'export%(exports)s from "%(url)s"\n',
            ),
            (
                r"""(?P<matched>import\s*['"](?P<url>[\.\/].*?)["']\s*)""",
                'import"%(url)s"\n',
            ),
            (
                r"""(?P<matched>import\(["'](?P<url>.*?)["']\)\.then)""",
                """import("%(url)s").then""",
            ),
            (
                r"""(?P<matched>await import\(["'](?P<url>.*?)["']\))""",
                """await import("%(url)s")""",
            ),
        ),
    )

    def post_process(self, paths, **options):
        collected = super().post_process(paths, **options)
        for original_path, processed_path, processed in collected:
            if isinstance(processed, Exception):
                print("Error with file", original_path)
                raise processed
            if processed_path.endswith(".js"):
                path = Path(settings.STATIC_ROOT) / processed_path
                initial = path.read_text()
                if "sourceMappingURL" not in initial:  # Already minified.
                    minified = jsmin(initial)
                    path.write_text(minified)
            if processed_path.endswith(".css"):
                path = Path(settings.STATIC_ROOT) / processed_path
                initial = path.read_text()
                if "sourceMappingURL" not in initial:  # Already minified.
                    minified = cssmin(initial)
                    path.write_text(minified)
            yield original_path, processed_path, True


class UmapS3(S3Storage):
    def get_reference_version(self, instance):
        metadata = self.connection.meta.client.head_object(
            Bucket=self.bucket_name, Key=instance.geojson.name
        )
        return metadata["VersionId"]

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
        return data["Body"].read()

    def get_version_path(self, ref, instance):
        return self.url(instance.geojson.name, parameters={"VersionId": ref})

    def onDatalayerSave(self, instance):
        pass

    def onDatalayerDelete(self, instance):
        pass


class UmapFileSystem(FileSystemStorage):
    def get_reference_version(self, instance):
        return self._extract_version_ref(instance.geojson.name)

    def make_filename(self, instance):
        root = self._base_path(instance)
        name = "%s_%s.geojson" % (instance.pk, int(time.time() * 1000))
        return root / name

    def list_versions(self, instance):
        root = self._base_path(instance)
        names = self.listdir(root)[1]
        names = [name for name in names if self._is_valid_version(name, instance)]
        versions = [self._version_metadata(name, instance) for name in names]
        versions.sort(reverse=True, key=operator.itemgetter("at"))
        return versions

    def get_version(self, ref, instance):
        with self.open(self.get_version_path(ref, instance), "r") as f:
            return f.read()

    def get_version_path(self, ref, instance):
        base_path = Path(settings.MEDIA_ROOT) / self._base_path(instance)
        fullpath = base_path / f"{instance.pk}_{ref}.geojson"
        if instance.old_id and not fullpath.exists():
            fullpath = base_path / f"{instance.old_id}_{ref}.geojson"
        if not fullpath.exists():
            raise ValueError(f"Invalid version reference: {ref}")
        return fullpath

    def onDatalayerSave(self, instance):
        self._purge_gzip(instance)
        self._purge_old_versions(instance, keep=settings.UMAP_KEEP_VERSIONS)

    def onDatalayerDelete(self, instance):
        self._purge_gzip(instance)
        self._purge_old_versions(instance, keep=None)

    def _extract_version_ref(self, path):
        version = path.split(".")[0]
        if "_" in version:
            return version.split("_")[-1]
        return version

    def _base_path(self, instance):
        path = ["datalayer", str(instance.map.pk)[-1]]
        if len(str(instance.map.pk)) > 1:
            path.append(str(instance.map.pk)[-2])
        path.append(str(instance.map.pk))
        return Path(os.path.join(*path))

    def _is_valid_version(self, name, instance):
        valid_prefixes = [name.startswith("%s_" % instance.pk)]
        if instance.old_id:
            valid_prefixes.append(name.startswith("%s_" % instance.old_id))
        return any(valid_prefixes) and name.endswith(".geojson")

    def _version_metadata(self, name, instance):
        ref = self._extract_version_ref(name)
        return {
            "name": name,
            "ref": ref,
            "at": ref,
            "size": self.size(self._base_path(instance) / name),
        }

    def _purge_old_versions(self, instance, keep=None):
        root = self._base_path(instance)
        versions = self.list_versions(instance)
        if keep is not None:
            versions = versions[keep:]
        for version in versions:
            name = version["name"]
            # Should not be in the list, but ensure to not delete the file
            # currently used in database
            if keep is not None and instance.geojson.name.endswith(name):
                continue
            try:
                self.delete(root / name)
            except FileNotFoundError:
                pass

    def _purge_gzip(self, instance):
        root = self._base_path(instance)
        names = self.listdir(root)[1]
        prefixes = [f"{instance.pk}_"]
        if instance.old_id:
            prefixes.append(f"{instance.old_id}_")
        prefixes = tuple(prefixes)
        for name in names:
            if name.startswith(prefixes) and name.endswith(".gz"):
                self.delete(root / name)
