import json

import pytest

from umap.models import Map

pytestmark = pytest.mark.django_db


def test_can_use_dict(map):
    d = {'locateControl': True}
    map.settings = d
    map.save()
    assert Map.objects.get(pk=map.pk).settings == d


def test_can_set_item(map):
    d = {'locateControl': True}
    map.settings = d
    map.save()
    map_inst = Map.objects.get(pk=map.pk)
    map_inst.settings['color'] = 'DarkGreen'
    assert map_inst.settings['locateControl'] is True


def test_should_return_a_dict_if_none(map):
    map.settings = None
    map.save()
    assert Map.objects.get(pk=map.pk).settings == {}


def test_should_not_double_dumps(map):
    map.settings = '{"locate": true}'
    map.save()
    assert Map.objects.get(pk=map.pk).settings == {'locate': True}


def test_value_to_string(map):
    d = {'locateControl': True}
    map.settings = d
    map.save()
    field = Map._meta.get_field('settings')
    assert json.loads(field.value_to_string(map)) == d
