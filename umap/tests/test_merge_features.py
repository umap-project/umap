import pytest

from umap.utils import merge_features


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
    assert merge_features(["A", "B"], ["A", "C"], ["A", "B", "D"]) == [
        "A",
        "C",
        "D",
    ]


def test_removing_same_element():
    # No added element (otherwise we cannot know if "new" elements are old modified
    # or old removed and new added).
    assert merge_features(["A", "B", "C"], ["A", "B"], ["A", "B"]) == [
        "A",
        "B",
    ]


def test_removing_changed_element():
    with pytest.raises(ValueError):
        merge_features(["A", "B"], ["A", "C"], ["A"])


def test_changing_removed_element():
    with pytest.raises(ValueError):
        merge_features(["A", "B"], ["A"], ["A", "C"])


def test_changing_same_element():
    with pytest.raises(ValueError):
        merge_features(["A", "B"], ["A", "D"], ["A", "C"])
    # Order does not count
    with pytest.raises(ValueError):
        merge_features(["A", "B", "C"], ["B", "D", "A"], ["A", "E", "B"])
