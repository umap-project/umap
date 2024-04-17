import pytest

from umap.utils import ConflictError, merge_features


def test_adding_one_element():
    assert merge_features(["A", "B"], ["A", "B", "C"], ["A", "B", "D"]) == [
        "A",
        "B",
        "C",
        "D",
    ]


def test_adding_elements():
    assert merge_features(["A", "B"], ["A", "B", "C", "D"], ["A", "B", "E", "F"]) == [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
    ]
    # Order does not count
    assert merge_features(["A", "B"], ["B", "C", "D", "A"], ["A", "B", "E", "F"]) == [
        "B",
        "C",
        "D",
        "A",
        "E",
        "F",
    ]


def test_adding_one_removing_one():
    assert merge_features(["A", "B"], ["A", "C"], ["A", "B", "D"]) == ["A", "C", "D"]


def test_removing_one():
    assert merge_features(["A", "B"], ["A", "B", "C"], ["A", "D"]) == ["A", "C", "D"]


def test_removing_same_element():
    # No added element (otherwise we cannot know if "new" elements are old modified
    # or old removed and new added).
    assert merge_features(["A", "B", "C"], ["A", "B"], ["A", "B"]) == [
        "A",
        "B",
    ]


def test_removing_changed_element():
    with pytest.raises(ConflictError):
        merge_features(["A", "B"], ["A", "C"], ["A"])


def test_changing_removed_element():
    with pytest.raises(ConflictError):
        merge_features(["A", "B"], ["A"], ["A", "C"])


def test_changing_same_element():
    with pytest.raises(ConflictError):
        merge_features(["A", "B"], ["A", "D"], ["A", "C"])
    # Order does not count
    with pytest.raises(ConflictError):
        merge_features(["A", "B", "C"], ["B", "D", "A"], ["A", "E", "B"])


def test_merge_with_ids_raises():
    # If reference doesn't have ids, but latest and incoming has
    # We need to raise as a conflict
    reference = [
        {"properties": {}, "geometry": "A"},
        {"properties": {}, "geometry": "B"},
    ]
    latest = [
        {"properties": {id: "100"}, "geometry": "A"},
        {"properties": {id: "101"}, "geometry": "B"},
    ]
    incoming = [
        {"properties": {id: "200"}, "geometry": "A"},
        {"properties": {id: "201"}, "geometry": "B"},
    ]

    with pytest.raises(ConflictError):
        merge_features(reference, latest, incoming)
