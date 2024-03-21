import pytest
from django.core.management import call_command

from umap.models import Map

pytestmark = pytest.mark.django_db


def test_can_delete_tilelayer_from_settings(map):
    map.settings["properties"]["tilelayer"] = {
        "name": "My TileLayer",
        "maxZoom": 18,
        "minZoom": 0,
        "attribution": "My attribution",
        "url_template": "http://{s}.foo.bar.baz/{z}/{x}/{y}.png",
    }
    map.save()
    # Make sure its saved
    map = Map.objects.get(pk=map.pk)
    assert "tilelayer" in map.settings["properties"]
    call_command(
        "clean_tilelayer", "http://{s}.foo.bar.baz/{z}/{x}/{y}.png", "--no-input"
    )
    map = Map.objects.get(pk=map.pk)
    assert "tilelayer" not in map.settings["properties"]


def test_can_replace_tilelayer_url_in_map_settings(map):
    map.settings["properties"]["tilelayer"] = {
        "name": "My TileLayer",
        "maxZoom": 18,
        "minZoom": 0,
        "attribution": "My attribution",
        "url_template": "http://{s}.foo.bar.baz/{z}/{x}/{y}.png",
    }
    map.save()
    new = "https://{s}.foo.bar.baz/{z}/{x}/{y}.png"
    call_command(
        "clean_tilelayer",
        "http://{s}.foo.bar.baz/{z}/{x}/{y}.png",
        new,
        "--no-input",
    )
    map = Map.objects.get(pk=map.pk)
    assert map.settings["properties"]["tilelayer"]["url_template"] == new


def test_can_replace_tilelayer_by_name_in_map_settings(map, tilelayer):
    map.settings["properties"]["tilelayer"] = {
        "name": "My TileLayer",
        "maxZoom": 18,
        "minZoom": 0,
        "attribution": "My attribution",
        "url_template": "http://{s}.foo.bar.baz/{z}/{x}/{y}.png",
    }
    map.save()
    call_command(
        "clean_tilelayer",
        "http://{s}.foo.bar.baz/{z}/{x}/{y}.png",
        tilelayer.name,
        "--no-input",
    )
    map = Map.objects.get(pk=map.pk)
    assert map.settings["properties"]["tilelayer"] == tilelayer.json


def test_can_replace_tilelayer_by_id_in_map_settings(map, tilelayer):
    map.settings["properties"]["tilelayer"] = {
        "name": "My TileLayer",
        "maxZoom": 18,
        "minZoom": 0,
        "attribution": "My attribution",
        "url_template": "http://{s}.foo.bar.baz/{z}/{x}/{y}.png",
    }
    map.save()
    call_command(
        "clean_tilelayer",
        "http://{s}.foo.bar.baz/{z}/{x}/{y}.png",
        tilelayer.pk,
        "--no-input",
    )
    map = Map.objects.get(pk=map.pk)
    assert map.settings["properties"]["tilelayer"] == tilelayer.json
