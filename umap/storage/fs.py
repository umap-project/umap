import operator
import os
import time
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage


class FSDataStorage(FileSystemStorage):
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
