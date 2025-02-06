import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_basic_choropleth_map_with_default_color(map, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/choropleth_region_chomage.geojson"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    # Hauts-de-France
    expect(page.locator("path[fill='#08519c']")).to_have_count(1)
    # Occitanie
    expect(page.locator("path[fill='#3182bd']")).to_have_count(1)
    # Grand-Est, PACA
    expect(page.locator("path[fill='#6baed6']")).to_have_count(2)
    # Bourgogne-Franche-Comté, Centre-Val-de-Loire, IdF, Normandie, Corse, Nouvelle-Aquitaine
    expect(page.locator("path[fill='#bdd7e7']")).to_have_count(6)
    # Bretagne, Pays de la Loire, AURA
    expect(page.locator("path[fill='#eff3ff']")).to_have_count(3)


def test_basic_choropleth_map_with_custom_brewer(openmap, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/choropleth_region_chomage.geojson"
    data = json.loads(path.read_text())

    # Change brewer at load
    data["_umap_options"]["choropleth"]["brewer"] = "Reds"
    DataLayerFactory(data=data, map=openmap)

    page.goto(f"{live_server.url}{openmap.get_absolute_url()}")
    # Hauts-de-France
    expect(page.locator("path[fill='#a50f15']")).to_have_count(1)
    # Occitanie
    expect(page.locator("path[fill='#de2d26']")).to_have_count(1)
    # Grand-Est, PACA
    expect(page.locator("path[fill='#fb6a4a']")).to_have_count(2)
    # Bourgogne-Franche-Comté, Centre-Val-de-Loire, IdF, Normandie, Corse, Nouvelle-Aquitaine
    expect(page.locator("path[fill='#fcae91']")).to_have_count(6)
    # Bretagne, Pays de la Loire, AURA
    expect(page.locator("path[fill='#fee5d9']")).to_have_count(3)

    # Now change brewer from UI
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Choropleth: settings").click()
    page.locator('select[name="brewer"]').select_option("Greens")

    # Hauts-de-France
    expect(page.locator("path[fill='#006d2c']")).to_have_count(1)
    # Occitanie
    expect(page.locator("path[fill='#31a354']")).to_have_count(1)
    # Grand-Est, PACA
    expect(page.locator("path[fill='#74c476']")).to_have_count(2)
    # Bourgogne-Franche-Comté, Centre-Val-de-Loire, IdF, Normandie, Corse, Nouvelle-Aquitaine
    expect(page.locator("path[fill='#bae4b3']")).to_have_count(6)
    # Bretagne, Pays de la Loire, AURA
    expect(page.locator("path[fill='#edf8e9']")).to_have_count(3)


def test_basic_choropleth_map_with_custom_classes(openmap, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/choropleth_region_chomage.geojson"
    data = json.loads(path.read_text())

    # Change brewer at load
    data["_umap_options"]["choropleth"]["classes"] = 6
    DataLayerFactory(data=data, map=openmap)

    page.goto(f"{live_server.url}{openmap.get_absolute_url()}")

    # Hauts-de-France
    expect(page.locator("path[fill='#08519c']")).to_have_count(1)
    # Occitanie
    expect(page.locator("path[fill='#3182bd']")).to_have_count(1)
    # PACA
    expect(page.locator("path[fill='#6baed6']")).to_have_count(1)
    # Grand-Est
    expect(page.locator("path[fill='#9ecae1']")).to_have_count(1)
    # Bourgogne-Franche-Comté, Centre-Val-de-Loire, IdF, Normandie, Corse, Nouvelle-Aquitaine
    expect(page.locator("path[fill='#c6dbef']")).to_have_count(6)
    # Bretagne, Pays de la Loire, AURA
    expect(page.locator("path[fill='#eff3ff']")).to_have_count(3)
