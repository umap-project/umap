"""Per-feature deadlines. Calendar dates always start at midnight UTC."""

import json
import re
from calendar import monthrange
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils.translation import gettext_lazy as _


def timing_for(feature):
    if not isinstance(feature, dict):
        return None
    properties = feature.get("properties") or {}
    options = properties.get("_umap_options") if isinstance(properties, dict) else None
    return options.get("timing") if isinstance(options, dict) else None


def parse_date(value):
    if not isinstance(value, str) or not re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value
    ):
        raise ValidationError(_("Use a calendar date in YYYY-MM-DD format (UTC)."))
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError(_("Invalid calendar date.")) from exc


def resolve_date(value, properties=None):
    """Only exact, top-level field references; never evaluate templates or code."""
    if value in (None, ""):
        return None
    if isinstance(value, str) and re.fullmatch(r"\{[^{}]+\}", value):
        key = value[1:-1]
        if properties is None:  # Validate a layer template without feature data.
            return None
        if not isinstance(properties, dict):
            raise ValidationError(_("Invalid calendar date."))
        value = properties.get(key)
        if value in (None, ""):
            return None
    if isinstance(value, str) and re.fullmatch(r"[0-9]{2}\.[0-9]{2}\.[0-9]{4}", value):
        value = f"{value[6:]}-{value[3:5]}-{value[:2]}"
    return parse_date(value)


def resolve_timing(timing, properties=None):
    if not isinstance(timing, dict) or type(timing.get("enabled", False)) is not bool:
        raise ValidationError(_("Timing must contain a boolean enabled option."))
    if timing.get("expiryAction", "delete") not in ("delete", "move"):
        raise ValidationError(_("Invalid GeoJSON or timing options."))
    if timing.get("expiryAction") == "move":
        try:
            identifier = timing.get("archiveLayer", "")
            if str(UUID(identifier)) != identifier.lower():
                raise ValueError("Noncanonical layer UUID")
        except (ValueError, TypeError, AttributeError) as exc:
            raise ValidationError(_("Invalid GeoJSON or timing options.")) from exc
    hide = resolve_date(timing.get("hideOn"), properties)
    delete = resolve_date(timing.get("deleteOn"), properties)
    delay = timing.get("deleteAfter")
    if delay not in (None, ""):
        unit = timing.get("deleteUnit", "days")
        if (
            type(delay) is not int
            or not 1 <= delay <= 36500
            or unit not in ("days", "months")
        ):
            raise ValidationError(_("Invalid calendar date."))
        if not timing.get("hideOn"):
            raise ValidationError(_("Delete on is required when timing is enabled."))
        # Explicit date and calculated date are mutually exclusive.
        if timing.get("deleteOn"):
            raise ValidationError(_("Invalid calendar date."))
        if hide:
            try:
                if unit == "days":
                    delete = hide + timedelta(days=delay)
                else:
                    months = hide.year * 12 + hide.month - 1 + delay
                    year, month = divmod(months, 12)
                    month += 1
                    delete = date(
                        year, month, min(hide.day, monthrange(year, month)[1])
                    )
            except (ValueError, OverflowError) as exc:
                raise ValidationError(_("Invalid calendar date.")) from exc
    if hide and delete and hide > delete:
        raise ValidationError(_("Hide from must not be after Delete on."))
    if timing.get("enabled") and not timing.get("deleteOn") and delay in (None, ""):
        raise ValidationError(_("Delete on is required when timing is enabled."))
    if any(
        isinstance(timing.get(key), str)
        and re.fullmatch(r"\{[^{}]+\}", timing[key])
        and resolved is None
        for key, resolved in (("hideOn", hide), ("deleteOn", delete))
    ):
        return None, None
    return hide, delete


def validate_timing(document):
    """Validate only the new option; preserve legacy GeoJSON behavior otherwise."""
    if not isinstance(document, dict) or not isinstance(
        document.get("features", []), list
    ):
        raise ValidationError(_("Invalid feature collection."))
    if any(not isinstance(feature, dict) for feature in document.get("features", [])):
        raise ValidationError(_("Invalid feature collection."))
    active = False
    for feature in document.get("features", []):
        timing = timing_for(feature)
        if timing is None:
            continue
        resolve_timing(timing, feature.get("properties") or {})
        if timing.get("enabled"):
            active = True
            identifier = feature.get("id")
            if not isinstance(identifier, str) or not 1 <= len(identifier) <= 255:
                raise ValidationError(_("A timed feature needs a stable string ID."))
    if active:
        ids = Counter(
            feature.get("id")
            for feature in document["features"]
            if isinstance(feature.get("id"), str)
        )
        timed_ids = [
            feature["id"]
            for feature in document["features"]
            if (timing_for(feature) or {}).get("enabled")
        ]
        if any(ids[identifier] != 1 for identifier in timed_ids):
            raise ValidationError(_("Timed feature IDs must be unique in their layer."))
    return active


def cleanup_layer(layer_id, now=None, dry_run=False):
    """Serialize cleanup with HTTP saves and persist deletion IDs across versions."""
    from .models import DataLayer, ExpiredFeature, Map

    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        raise ValueError("Cleanup requires a timezone-aware timestamp.")
    now = now.astimezone(UTC)
    today = now.astimezone(UTC).date()
    from .feature_archiving import process_archives

    archived = process_archives(layer_id, now, dry_run=dry_run)
    with transaction.atomic():
        map_id = DataLayer.objects.values_list("map_id", flat=True).get(pk=layer_id)
        map_instance = Map.objects.select_for_update().get(pk=map_id)
        layer = DataLayer.objects.select_for_update().get(pk=layer_id)
        if (
            map_instance.share_status == Map.DELETED
            or layer.share_status == DataLayer.DELETED
            or not layer.geojson
        ):
            return archived
        # Remote data belongs to another service, never modify it here.
        if ((layer.settings or {}).get("remoteData") or {}).get("url"):
            return archived
        with layer.geojson.open("rb") as source:
            document = json.load(source)
        if not validate_timing(document):
            return archived
        expired = [
            feature
            for feature in document["features"]
            if (timing_for(feature) or {}).get("enabled")
            and timing_for(feature).get("expiryAction", "delete") == "delete"
            and (
                deadline := resolve_timing(
                    timing_for(feature), feature.get("properties") or {}
                )[1]
            )
            is not None
            and deadline <= today
        ]
        if not expired or dry_run:
            return archived + len(expired)
        ids = {feature["id"] for feature in expired}
        document["features"] = [
            f
            for f in document["features"]
            if not isinstance(f.get("id"), str) or f["id"] not in ids
        ]
        ExpiredFeature.objects.bulk_create(
            [
                ExpiredFeature(datalayer=layer, feature_id=identifier)
                for identifier in ids
            ],
            ignore_conflicts=True,
        )
        layer.geojson.save(
            "timed-cleanup.geojson",
            ContentFile(json.dumps(document).encode()),
            save=False,
        )
        layer.save(update_fields=["geojson", "modified_at"])
        Map.objects.filter(pk=layer.map_id).update(modified_at=now)
        return archived + len(expired)
