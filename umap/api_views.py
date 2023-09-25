from rest_framework import generics, status
from rest_framework.response import Response

from .models import Map
from .serializers import MapSerializer
from .views import ANONYMOUS_COOKIE_MAX_AGE


class MapList(generics.ListCreateAPIView):
    queryset = Map.public.all().order_by("-modified_at")
    serializer_class = MapSerializer

    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(owner=self.request.user)
        else:
            serializer.save()

    def get_map_permissions(self, map_):
        permissions = {}
        permissions["edit_status"] = map_.edit_status
        permissions["share_status"] = map_.share_status
        if map_.owner:
            permissions["owner"] = {
                "id": map_.owner.pk,
                "name": str(map_.owner),
                "url": map_.owner.get_url(),
            }
            permissions["editors"] = [
                {"id": editor.pk, "name": str(editor)} for editor in map_.editors.all()
            ]
        if not map_.owner and map_.is_anonymous_owner(self.request):
            permissions["anonymous_edit_url"] = map_.get_anonymous_edit_url()
        return permissions

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        map_ = serializer.instance
        headers = self.get_success_headers(serializer.data)
        data = serializer.data
        permissions = self.get_map_permissions(map_)
        if not map_.owner:
            anonymous_url = map_.get_anonymous_edit_url()
            permissions["anonymous_edit_url"] = anonymous_url
        data["permissions"] = permissions
        response = Response(data, status=status.HTTP_201_CREATED, headers=headers)
        if not self.request.user.is_authenticated:
            key, value = map_.signed_cookie_elements
            response.set_signed_cookie(
                key=key, value=value, max_age=ANONYMOUS_COOKIE_MAX_AGE
            )
        return response


class MapDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Map.public.all().order_by("-modified_at")
    serializer_class = MapSerializer
