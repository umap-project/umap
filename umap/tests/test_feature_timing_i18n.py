"""Check completeness and runtime loading, not linguistic correctness."""

import ast
import gettext
import json
import re
from pathlib import Path

import pytest
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.translation import override, to_locale

from umap.feature_timing import validate_timing

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "static/umap/locale"
UI_MESSAGES = [
    "Feature timing",
    "Automatic cleanup",
    "Hide from (optional)",
    "Delete on",
    "Required for automatic cleanup. Dates start at midnight UTC. Hidden features remain accessible; older versions and backups may retain deleted features.",
    "Invalid feature timing. Delete on is required for automatic cleanup; Hide from must not be later. Use calendar dates in UTC.",
    "This layer changed and uses automatic cleanup. Reload the map before saving to avoid restoring deleted features.",
    "Use a date or a field reference such as {Ende}. Empty referenced fields pause the schedule.",
    "Delete after hiding",
    "Enter a delay instead of Delete on. Calendar months end on the last available day.",
    "Unit",
    "Days",
    "Months",
    "Applied to newly drawn features only. Existing features keep their own schedule.",
    "Use for new features in this layer",
    "Invalid calendar date.",
    "Enable timing",
    "At expiration",
    "Move to layer (keep)",
    "Destination layer",
    "Choose a saved local layer with compatible edit permissions. Moving disables timing. Older versions remain; reload to see background changes.",
    "Move on",
    "Move after hiding",
]


@pytest.mark.parametrize("code", sorted(p.stem for p in FRONTEND.glob("*.json")))
def test_timing_frontend_catalog_and_generated_module_match(code):
    catalog = json.loads((FRONTEND / f"{code}.json").read_text(encoding="utf-8"))
    if code in {to_locale(language) for language, name in settings.LANGUAGES}:
        module = (FRONTEND / f"{code}.js").read_text(encoding="utf-8")
        match = re.search(r"registerLocale\('[^']+',\s*", module)
        assert match is not None
        generated, end = json.JSONDecoder().raw_decode(module[match.end() :])
        assert generated == catalog
        assert module[match.end() + end :].strip() == ")"
    for message in UI_MESSAGES:
        assert isinstance(catalog[message], str) and catalog[message].strip()
        if code not in ("en", "en_US") and (code, message) != ("ms", "Unit"):
            assert catalog[message] != message


@pytest.mark.parametrize("code", [code for code, name in settings.LANGUAGES])
def test_timing_validation_messages_are_translated_at_runtime(code):
    messages = set()
    for filename in ("feature_timing.py", "feature_archiving.py", "forms.py"):
        tree = ast.parse((ROOT / filename).read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "_"
            ):
                messages.add(node.args[0].value)
    assert len(messages) == 10
    with (ROOT / "locale" / to_locale(code) / "LC_MESSAGES/django.mo").open(
        "rb"
    ) as source:
        catalog = gettext.GNUTranslations(source)
    for message in messages:
        result = catalog.gettext(message)
        assert isinstance(result, str) and result.strip()
        if code != "en":
            assert result != message
    invalid = {
        "features": [
            {
                "id": "ABCDE",
                "properties": {"_umap_options": {"timing": {"enabled": True}}},
            }
        ]
    }
    with override(code):
        with pytest.raises(ValidationError) as error:
            validate_timing(invalid)
        assert error.value.messages == [
            catalog.gettext("Delete on is required when timing is enabled.")
        ]
