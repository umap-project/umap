from django.conf import settings

from pgindex import IndexBase, Vector, register

from leaflet_storage.models import Map


class UnaccentVector(Vector):

    @property
    def tsvector(self):
        if getattr(settings, "UMAP_USE_UNACCENT", False):
            return u"setweight(to_tsvector('%s', unaccent(E'%s')), '%s')" % (
                self.dictionary, self.value, self.weight
            )
        else:
            return super(UnaccentVector, self).tsvector


class MapIndex(IndexBase):

    def get_title(self):
        return self.obj.name

    def get_start_publish(self):
        return self.obj.modified_at

    def get_publish(self):
        return self.obj.share_status == Map.PUBLIC

    def get_vectors(self):
        vectors = []
        if self.obj.name:
            vectors.append(UnaccentVector(self.obj.name, weight='A'))
        if self.obj.description:
            vectors.append(UnaccentVector(self.obj.description, weight='B'))
        if self.obj.owner:
            vectors.append(UnaccentVector(self.obj.owner.username))
        return vectors

register(Map, MapIndex)
