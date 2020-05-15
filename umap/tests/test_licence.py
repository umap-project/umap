import pytest

from umap.models import DataLayer, Map

pytestmark = pytest.mark.django_db


def test_licence_delete_should_not_remove_linked_maps(map, licence, datalayer):
    assert map.licence == licence
    licence.delete()
    assert Map.objects.filter(pk=map.pk).exists()
    assert DataLayer.objects.filter(pk=datalayer.pk).exists()
