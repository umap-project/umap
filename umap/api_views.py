from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import BasePermission
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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        map_ = serializer.instance
        headers = self.get_success_headers(serializer.data)
        data = serializer.data
        if not map_.owner:
            anonymous_url = map_.get_anonymous_edit_url()
            data["permissions"]["anonymous_edit_url"] = anonymous_url
        response = Response(data, status=status.HTTP_201_CREATED, headers=headers)
        if not self.request.user.is_authenticated:
            key, value = map_.signed_cookie_elements
            response.set_signed_cookie(
                key=key, value=value, max_age=ANONYMOUS_COOKIE_MAX_AGE
            )
        return response


class MapPermission(BasePermission):
    def has_permission(self, request, view):
        map_inst = get_object_or_404(Map, pk=view.kwargs.get("pk"))
        if request.method == "PUT":
            return map_inst.can_edit(user=request.user, request=request)
        if request.method == "GET":
            return map_inst.can_view(request)


class MapDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Map.public.all().order_by("-modified_at")
    serializer_class = MapSerializer

    permission_classes = [MapPermission]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        if not instance.owner and instance.is_anonymous_owner(request):
            data["permissions"][
                "anonymous_edit_url"
            ] = instance.get_anonymous_edit_url()
        return Response(data)
