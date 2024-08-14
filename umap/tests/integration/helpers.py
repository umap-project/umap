import json
import re
from pathlib import Path

from umap.models import DataLayer


def save_and_get_json(page):
    with page.expect_response(re.compile(r".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save").click()
    datalayer = DataLayer.objects.last()
    return json.loads(Path(datalayer.geojson.path).read_text())
