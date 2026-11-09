"""Recoverable, copy-before-remove expiry transfers within one map."""

import json
from copy import deepcopy
from hashlib import sha256
from uuid import UUID

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from .feature_timing import resolve_timing, timing_for, validate_timing
from .models import DataLayer, ExpiredFeature, FeatureArchive, Map


def invalid_target():
    return ValidationError(
        _("Invalid GeoJSON or timing options."), code="invalid_archive"
    )


def fingerprint(value):
    return sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=True).encode()
    ).hexdigest()


def read_layer(layer):
    if not layer.geojson:
        return {
            "type": "FeatureCollection",
            "properties": layer.settings or {},
            "features": [],
        }
    with layer.geojson.storage.open(layer.geojson.name, "rb") as source:
        return json.load(source)


def effective_edit_status(layer, layers):
    seen = set()
    while layer.edit_status == DataLayer.INHERIT and layer.parent_id:
        if layer.pk in seen or layer.parent_id not in layers:
            raise invalid_target()
        seen.add(layer.pk)
        layer = layers[layer.parent_id]
    return (
        layer.map.edit_status
        if layer.edit_status == DataLayer.INHERIT
        else layer.edit_status
    )


def archive_target(source, identifier, layers, request=None):
    try:
        target = layers[UUID(identifier)]
    except (ValueError, TypeError, AttributeError, KeyError) as exc:
        raise invalid_target() from exc
    properties = target.settings or {}
    if (
        target.pk == source.pk
        or target.map_id != source.map_id
        or target.share_status == DataLayer.DELETED
        or properties.get("group")
        or (properties.get("remoteData") or {}).get("url")
        or any(layer.parent_id == target.pk for layer in layers.values())
        # The worker must not become a way to write into a more restricted layer.
        or effective_edit_status(target, layers) > effective_edit_status(source, layers)
        or (request is not None and not target.can_edit(request))
    ):
        raise invalid_target()
    return target


def validate_archive_targets(source, timings, request=None):
    active = [
        timing
        for timing in timings
        if timing and timing.get("enabled") and timing.get("expiryAction") == "move"
    ]
    if not active:
        return
    layers = {
        layer.pk: layer
        for layer in DataLayer.objects.filter(map_id=source.map_id).select_related(
            "map"
        )
    }
    layers[source.pk] = source
    for timing in active:
        archive_target(source, timing.get("archiveLayer"), layers, request=request)


def has_pending_archive(layer_id):
    return FeatureArchive.objects.filter(
        Q(source_id=layer_id) | Q(target_id=layer_id), completed=False
    ).exists()


def locked_map_layers(layer_id):
    map_id = DataLayer.objects.values_list("map_id", flat=True).get(pk=layer_id)
    map_instance = Map.objects.select_for_update().get(pk=map_id)
    layers = {
        layer.pk: layer
        for layer in DataLayer.objects.select_for_update()
        .filter(map_id=map_id)
        .order_by("pk")
    }
    for layer in layers.values():
        layer.map = map_instance
    return map_instance, layers


def write_layer(layer, document, now, settings_changed=False):
    """Keep old FS versions until the pointer transaction has actually committed."""
    layer.geojson.save(
        "timed-archive.geojson", ContentFile(json.dumps(document).encode()), save=False
    )
    updates = {"geojson": layer.geojson.name, "modified_at": now}
    if settings_changed:
        updates["settings"] = layer.settings
    DataLayer.objects.filter(pk=layer.pk).update(**updates)
    transaction.on_commit(lambda: layer.geojson.storage.onDatalayerSave(layer))


def prepare_archives(layer_id, now, dry_run=False):
    """Commit recovery payloads before touching either storage object."""
    with transaction.atomic():
        map_instance, layers = locked_map_layers(layer_id)
        source = layers[UUID(str(layer_id))]
        if (
            map_instance.share_status == Map.DELETED
            or source.share_status == DataLayer.DELETED
        ):
            return 0
        if ((source.settings or {}).get("remoteData") or {}).get("url"):
            return 0
        document = read_layer(source)
        validate_timing(document)
        due = []
        for feature in document.get("features", []):
            timing = timing_for(feature)
            if (
                not timing
                or not timing.get("enabled")
                or timing.get("expiryAction") != "move"
            ):
                continue
            deadline = resolve_timing(timing, feature.get("properties") or {})[1]
            if deadline is None or deadline > now.date():
                continue
            existing = FeatureArchive.objects.filter(
                source=source, feature_id=feature["id"]
            ).first()
            if existing:
                if existing.completed:
                    raise invalid_target()  # A raw-storage resurrection is never moved twice.
                continue
            target = archive_target(source, timing.get("archiveLayer"), layers)
            target_data = read_layer(target)
            validate_timing(target_data)
            if (
                any(
                    item.get("id") == feature["id"]
                    for item in target_data.get("features", [])
                )
                or ExpiredFeature.objects.filter(
                    datalayer=target, feature_id=feature["id"]
                ).exists()
                or FeatureArchive.objects.filter(
                    target=target, feature_id=feature["id"]
                ).exists()
            ):
                raise invalid_target()  # Never overwrite an unrelated object or revive an expired ID.
            due.append((feature, target))
        pending = FeatureArchive.objects.filter(source=source, completed=False).count()
        if dry_run:
            return pending + len(due)
        for feature, target in due:
            job = FeatureArchive(
                source=source,
                target=target,
                feature_id=feature["id"],
                source_hash=fingerprint(feature),
            )
            payload = deepcopy(feature)
            options = payload["properties"].setdefault("_umap_options", {})
            options["timing"]["enabled"] = False
            options["timing"].pop("expiryAction", None)
            options["timing"].pop("archiveLayer", None)
            options["timingArchive"] = {
                "transfer": str(job.pk),
                "sourceLayer": str(source.pk),
                "at": now.isoformat(),
            }
            job.payload = payload
            job.save()
    return pending + len(due)


def complete_archive(job_id, now):
    with transaction.atomic():
        source_id = FeatureArchive.objects.values_list("source_id", flat=True).get(
            pk=job_id
        )
        map_instance, layers = locked_map_layers(source_id)
        job = FeatureArchive.objects.select_for_update().get(pk=job_id)
        if job.completed:
            return 0
        source = layers[job.source_id]
        if (
            map_instance.share_status == Map.DELETED
            or source.share_status == DataLayer.DELETED
        ):
            return 0
        target = archive_target(source, str(job.target_id), layers)
        source_data, target_data = read_layer(source), read_layer(target)
        originals = [
            item
            for item in source_data.get("features", [])
            if item.get("id") == job.feature_id
        ]
        if len(originals) > 1 or (
            originals and fingerprint(originals[0]) != job.source_hash
        ):
            raise invalid_target()
        copies = [
            item
            for item in target_data.get("features", [])
            if item.get("id") == job.feature_id
        ]
        if copies and (
            len(copies) != 1 or fingerprint(copies[0]) != fingerprint(job.payload)
        ):
            raise invalid_target()
        if not copies:
            target_data.setdefault("features", []).append(job.payload)
        # Preserve the source column definitions without replacing target definitions.
        properties = deepcopy(target.settings or {})
        fields = properties.setdefault("fields", [])
        known = {field["key"] for field in fields}
        for field in (source.settings or {}).get("fields", []):
            if field["key"] in job.payload["properties"] and field["key"] not in known:
                fields.append(deepcopy(field))
                known.add(field["key"])
        target.settings = properties
        target_data["properties"] = properties
        generation = target.archive_generation + 1
        target_data["archiveGeneration"] = generation
        write_layer(target, target_data, now, settings_changed=True)
        # Read back through the storage API before removing anything from source.
        written = [
            item
            for item in read_layer(target).get("features", [])
            if item.get("id") == job.feature_id
        ]
        if len(written) != 1 or fingerprint(written[0]) != fingerprint(job.payload):
            raise OSError("Archive copy verification failed")
        if originals:
            source_data["features"] = [
                item
                for item in source_data["features"]
                if item.get("id") != job.feature_id
            ]
            write_layer(source, source_data, now)
        DataLayer.objects.filter(pk=source.pk).update(modified_at=now)
        ExpiredFeature.objects.get_or_create(
            datalayer=source, feature_id=job.feature_id
        )
        DataLayer.objects.filter(pk=target.pk).update(archive_generation=generation)
        Map.objects.filter(pk=map_instance.pk).update(modified_at=now)
        job.completed = True
        job.payload = {}  # Recovery data is no longer needed after the durable transfer.
        job.save(update_fields=["completed", "payload"])
        return 1


def process_archives(layer_id, now, dry_run=False):
    # Ordinary layers do not need a map-wide transfer lock. A schedule added
    # after this advisory read is picked up on the next worker pass.
    if not FeatureArchive.objects.filter(source_id=layer_id, completed=False).exists():
        layer = DataLayer.objects.get(pk=layer_id)
        document = read_layer(layer)
        features = document.get("features", []) if isinstance(document, dict) else []
        if not isinstance(features, list) or not any(
            isinstance(timing_for(feature), dict)
            and timing_for(feature).get("enabled")
            and timing_for(feature).get("expiryAction") == "move"
            for feature in features
        ):
            return 0
    count = prepare_archives(layer_id, now, dry_run=dry_run)
    if dry_run or not count:
        return count
    completed = 0
    for identifier in FeatureArchive.objects.filter(
        source_id=layer_id, completed=False
    ).values_list("pk", flat=True):
        try:
            completed += complete_archive(identifier, now)
        except FeatureArchive.DoesNotExist:
            # A deliberate hard deletion of a layer can cancel its queued jobs.
            continue
    return completed
