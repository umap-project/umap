import json
import operator
import os
import time
import uuid
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.gis.db import models
from django.core.files.base import File
from django.core.signing import Signer
from django.template.defaultfilters import slugify
from django.urls import reverse
from django.utils.functional import classproperty
from django.utils.translation import gettext_lazy as _

from .managers import PublicManager
from .utils import _urls_for_js


# Did not find a clean way to do this in Django
# - creating a Proxy model would mean replacing get_user_model by this proxy model
#   in every template
# - extending User model would mean a non trivial migration
def display_name(self):
    return settings.USER_DISPLAY_NAME.format(**self.__dict__)


def get_user_url(self):
    identifier = getattr(self, settings.USER_URL_FIELD)
    return reverse(settings.USER_MAPS_URL, kwargs={"identifier": identifier})


def get_user_stars_url(self):
    identifier = getattr(self, settings.USER_URL_FIELD)
    return reverse("user_stars", kwargs={"identifier": identifier})


User.add_to_class("__str__", display_name)
User.add_to_class("get_url", get_user_url)
User.add_to_class("get_stars_url", get_user_stars_url)


def get_default_share_status():
    return settings.UMAP_DEFAULT_SHARE_STATUS or Map.PUBLIC


def get_default_edit_status():
    return settings.UMAP_DEFAULT_EDIT_STATUS or Map.OWNER


class Team(models.Model):
    name = models.CharField(
        max_length=200, verbose_name=_("name"), unique=True, blank=False, null=False
    )
    description = models.TextField(blank=True, null=True, verbose_name=_("description"))
    users = models.ManyToManyField(User, related_name="teams")

    def __unicode__(self):
        return self.name

    def __str__(self):
        return self.name

    def get_url(self):
        return reverse("team_maps", kwargs={"pk": self.pk})

    def get_metadata(self):
        return {"id": self.pk, "name": self.name, "url": self.get_url()}


class NamedModel(models.Model):
    name = models.CharField(max_length=200, verbose_name=_("name"))

    class Meta:
        abstract = True
        ordering = ("name",)

    def __unicode__(self):
        return self.name

    def __str__(self):
        return self.name


def get_default_licence():
    """
    Returns a default Licence, creates it if it doesn't exist.
    Needed to prevent a licence deletion from deleting all the linked
    maps.
    """
    return Licence.objects.get_or_create(
        # can't use ugettext_lazy for database storage, see #13965
        name=getattr(settings, "UMAP_DEFAULT_LICENCE_NAME", "No licence set")
    )[0]


class Licence(NamedModel):
    """
    The licence one map is published on.
    """

    details = models.URLField(
        verbose_name=_("details"),
        help_text=_("Link to a page where the licence is detailed."),
    )

    @property
    def json(self):
        return {"name": self.name, "url": self.details}


class TileLayer(NamedModel):
    url_template = models.CharField(
        max_length=400, help_text=_("URL template using OSM tile format")
    )
    minZoom = models.IntegerField(default=0)
    maxZoom = models.IntegerField(default=18)
    attribution = models.CharField(max_length=300)
    rank = models.SmallIntegerField(
        blank=True, null=True, help_text=_("Order of the tilelayers in the edit box")
    )
    # See https://wiki.openstreetmap.org/wiki/TMS#The_Y_coordinate
    tms = models.BooleanField(default=False)

    @property
    def json(self):
        return dict(
            (field.name, getattr(self, field.name)) for field in self._meta.fields
        )

    @classmethod
    def get_default(cls):
        """
        Returns the default tile layer (used for a map when no layer is set).
        """
        return cls.objects.order_by("rank")[0]  # FIXME, make it administrable

    @classmethod
    def get_list(cls):
        default = cls.get_default()
        l = []
        for t in cls.objects.all():
            fields = t.json
            if default and default.pk == t.pk:
                fields["selected"] = True
            l.append(fields)
        return l

    class Meta:
        ordering = ("rank", "name")


class Map(NamedModel):
    """
    A single thematical map.
    """

    ANONYMOUS = 1
    COLLABORATORS = 2
    OWNER = 3
    PUBLIC = 1
    OPEN = 2
    PRIVATE = 3
    BLOCKED = 9
    EDIT_STATUS = (
        (ANONYMOUS, _("Everyone")),
        (COLLABORATORS, _("Editors and team only")),
        (OWNER, _("Owner only")),
    )
    SHARE_STATUS = (
        (PUBLIC, _("Everyone (public)")),
        (OPEN, _("Anyone with link")),
        (PRIVATE, _("Editors and team only")),
        (BLOCKED, _("Blocked")),
    )
    slug = models.SlugField(db_index=True)
    center = models.PointField(geography=True, verbose_name=_("center"))
    zoom = models.IntegerField(default=7, verbose_name=_("zoom"))
    locate = models.BooleanField(
        default=False, verbose_name=_("locate"), help_text=_("Locate user on load?")
    )
    licence = models.ForeignKey(
        Licence,
        help_text=_("Choose the map licence."),
        verbose_name=_("licence"),
        on_delete=models.SET_DEFAULT,
        default=get_default_licence,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        related_name="owned_maps",
        verbose_name=_("owner"),
        on_delete=models.PROTECT,
    )
    editors = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, verbose_name=_("editors")
    )
    team = models.ForeignKey(
        Team,
        blank=True,
        null=True,
        verbose_name=_("team"),
        on_delete=models.SET_NULL,
    )
    edit_status = models.SmallIntegerField(
        choices=EDIT_STATUS,
        default=get_default_edit_status,
        verbose_name=_("edit status"),
    )
    share_status = models.SmallIntegerField(
        choices=SHARE_STATUS,
        default=get_default_share_status,
        verbose_name=_("share status"),
    )
    settings = models.JSONField(
        blank=True, null=True, verbose_name=_("settings"), default=dict
    )

    objects = models.Manager()
    public = PublicManager()

    @property
    def description(self):
        try:
            return self.settings["properties"]["description"]
        except KeyError:
            return ""

    @property
    def preview_settings(self):
        layers = self.datalayer_set.all()
        datalayer_data = [c.metadata() for c in layers]
        map_settings = self.settings
        if "properties" not in map_settings:
            map_settings["properties"] = {}
        map_settings["properties"].update(
            {
                "tilelayers": [TileLayer.get_default().json],
                "datalayers": datalayer_data,
                "urls": _urls_for_js(),
                "STATIC_URL": settings.STATIC_URL,
                "editMode": "disabled",
                "hash": False,
                "scrollWheelZoom": False,
                "noControl": True,
                "umap_id": self.pk,
                "schema": self.extra_schema,
                "slideshow": {},
            }
        )
        return map_settings

    def delete(self, **kwargs):
        # Explicitely call datalayers.delete, so we can deal with removing files
        # (the cascade delete would not call the model delete method)
        for datalayer in self.datalayer_set.all():
            datalayer.delete()
        return super().delete(**kwargs)

    def generate_umapjson(self, request):
        umapjson = self.settings
        umapjson["type"] = "umap"
        umapjson["uri"] = request.build_absolute_uri(self.get_absolute_url())
        datalayers = []
        for datalayer in self.datalayer_set.all():
            with open(datalayer.geojson.path, "rb") as f:
                layer = json.loads(f.read())
            if datalayer.settings:
                layer["_umap_options"] = datalayer.settings
            datalayers.append(layer)
        umapjson["layers"] = datalayers
        return umapjson

    def get_absolute_url(self):
        return reverse("map", kwargs={"slug": self.slug or "map", "map_id": self.pk})

    def get_anonymous_edit_url(self):
        signer = Signer()
        signature = signer.sign(self.pk)
        path = reverse("map_anonymous_edit_url", kwargs={"signature": signature})
        return settings.SITE_URL + path

    def get_author(self):
        return self.team or self.owner

    def is_owner(self, request=None):
        if not request:
            return False
        if request.user and self.owner == request.user:
            return True
        return self.is_anonymous_owner(request)

    def is_anonymous_owner(self, request):
        if not request or self.owner:
            # edit cookies are only valid while the map doesn't have owner
            return False
        key, value = self.signed_cookie_elements
        try:
            has_anonymous_cookie = int(request.get_signed_cookie(key, False)) == value
        except ValueError:
            has_anonymous_cookie = False
        return has_anonymous_cookie

    def can_delete(self, request=None):
        if not request:
            return False
        if self.owner and request.user != self.owner:
            return False
        if not self.owner and not self.is_anonymous_owner(request):
            return False
        return True

    def can_edit(self, request=None):
        """
        Define if a user can edit or not the instance, according to his account
        or the request.

        In owner mode:
            - only owner by default (OWNER)
            - any editor or team member if mode is COLLABORATORS
            - anyone otherwise (ANONYMOUS)
        In anonymous owner mode:
            - only owner (has ownership cookie) by default (OWNER)
            - anyone otherwise (ANONYMOUS)
        """
        can = False
        if not request:
            return False
        user = request.user
        if (
            not self.owner
            and settings.UMAP_ALLOW_ANONYMOUS
            and self.is_anonymous_owner(request)
        ):
            can = True
        elif self.edit_status == self.ANONYMOUS:
            can = True
        elif not user.is_authenticated:
            can = False
        elif user == self.owner:
            can = True
        elif self.edit_status == self.COLLABORATORS:
            if user in self.editors.all() or self.team in user.teams.all():
                can = True
        return can

    def can_view(self, request):
        if self.share_status == self.BLOCKED:
            can = False
        elif self.owner is None:
            can = True
        elif self.share_status in [self.PUBLIC, self.OPEN]:
            can = True
        elif not request.user.is_authenticated:
            can = False
        elif request.user == self.owner:
            can = True
        else:
            can = not (
                self.share_status == self.PRIVATE
                and request.user not in self.editors.all()
                and self.team not in request.user.teams.all()
            )
        return can

    @property
    def signed_cookie_elements(self):
        return ("anonymous_owner|%s" % self.pk, self.pk)

    def get_tilelayer(self):
        return self.tilelayer or TileLayer.get_default()

    def clone(self, **kwargs):
        new = self.__class__.objects.get(pk=self.pk)
        new.pk = None
        new.name = "%s %s" % (_("Clone of"), self.name)
        if "owner" in kwargs:
            # can be None in case of anonymous cloning
            new.owner = kwargs["owner"]
        new.save()
        for editor in self.editors.all():
            new.editors.add(editor)
        for datalayer in self.datalayer_set.all():
            datalayer.clone(map_inst=new)
        return new

    @classproperty
    def extra_schema(self):
        return {
            "iconUrl": {
                "default": "%sumap/img/marker.svg" % settings.STATIC_URL,
            }
        }


class Pictogram(NamedModel):
    """
    An image added to an icon of the map.
    """

    attribution = models.CharField(max_length=300)
    category = models.CharField(max_length=300, null=True, blank=True)
    pictogram = models.FileField(upload_to="pictogram")

    @property
    def json(self):
        return {
            "id": self.pk,
            "attribution": self.attribution,
            "name": self.name,
            "category": self.category,
            "src": self.pictogram.url,
        }


# Must be out of Datalayer for Django migration to run, because of python 2
# serialize limitations.
def upload_to(instance, filename):
    if instance.pk:
        return instance.upload_to()
    name = "%s.geojson" % slugify(instance.name)[:50] or "untitled"
    return os.path.join(instance.storage_root(), name)


class DataLayer(NamedModel):
    """
    Layer to store Features in.
    """

    INHERIT = 0
    ANONYMOUS = 1
    COLLABORATORS = 2
    OWNER = 3
    EDIT_STATUS = (
        (INHERIT, _("Inherit")),
        (ANONYMOUS, _("Everyone")),
        (COLLABORATORS, _("Editors and team only")),
        (OWNER, _("Owner only")),
    )
    uuid = models.UUIDField(
        unique=True, primary_key=True, default=uuid.uuid4, editable=False
    )
    old_id = models.IntegerField(null=True, blank=True)
    map = models.ForeignKey(Map, on_delete=models.CASCADE)
    description = models.TextField(blank=True, null=True, verbose_name=_("description"))
    geojson = models.FileField(upload_to=upload_to, blank=True, null=True)
    display_on_load = models.BooleanField(
        default=False,
        verbose_name=_("display on load"),
        help_text=_("Display this layer on load."),
    )
    rank = models.SmallIntegerField(default=0)
    settings = models.JSONField(
        blank=True, null=True, verbose_name=_("settings"), default=dict
    )
    edit_status = models.SmallIntegerField(
        choices=EDIT_STATUS,
        default=INHERIT,
        verbose_name=_("edit status"),
    )

    class Meta:
        ordering = ("rank",)

    def save(self, force_insert=False, force_update=False, **kwargs):
        is_new = not bool(self.pk)
        super(DataLayer, self).save(
            force_insert=force_insert, force_update=force_update, **kwargs
        )

        if is_new:
            force_insert, force_update = False, True
            filename = self.upload_to()
            old_name = self.geojson.name
            new_name = self.geojson.storage.save(filename, self.geojson)
            self.geojson.storage.delete(old_name)
            self.geojson.name = new_name
            super(DataLayer, self).save(
                force_insert=force_insert, force_update=force_update, **kwargs
            )
        self.purge_gzip()
        self.purge_old_versions()

    def delete(self, **kwargs):
        self.purge_gzip()
        self.to_purgatory()
        return super().delete(**kwargs)

    def to_purgatory(self):
        dest = Path(settings.UMAP_PURGATORY_ROOT)
        dest.mkdir(parents=True, exist_ok=True)
        src = Path(self.geojson.storage.location) / self.storage_root()
        for version in self.versions:
            name = version["name"]
            (src / name).rename(dest / f"{self.map.pk}_{name}")

    def upload_to(self):
        root = self.storage_root()
        name = "%s_%s.geojson" % (self.pk, int(time.time() * 1000))
        return os.path.join(root, name)

    def storage_root(self):
        path = ["datalayer", str(self.map.pk)[-1]]
        if len(str(self.map.pk)) > 1:
            path.append(str(self.map.pk)[-2])
        path.append(str(self.map.pk))
        return os.path.join(*path)

    def metadata(self, request=None):
        # Retrocompat: minimal settings for maps not saved after settings property
        # has been introduced
        obj = self.settings or {
            "name": self.name,
            "displayOnLoad": self.display_on_load,
        }
        if self.old_id:
            obj["old_id"] = self.old_id
        obj["id"] = self.pk
        obj["permissions"] = {"edit_status": self.edit_status}
        obj["editMode"] = "advanced" if self.can_edit(request) else "disabled"
        return obj

    def clone(self, map_inst=None):
        new = self.__class__.objects.get(pk=self.pk)
        new._state.adding = True
        new.pk = None
        if map_inst:
            new.map = map_inst
        new.geojson = File(new.geojson.file.file)
        new.save()
        return new

    def is_valid_version(self, name):
        valid_prefixes = [name.startswith("%s_" % self.pk)]
        if self.old_id:
            valid_prefixes.append(name.startswith("%s_" % self.old_id))
        return any(valid_prefixes) and name.endswith(".geojson")

    def version_metadata(self, name):
        els = name.split(".")[0].split("_")
        return {
            "name": name,
            "at": els[1],
            "size": self.geojson.storage.size(self.get_version_path(name)),
        }

    @property
    def versions(self):
        root = self.storage_root()
        names = self.geojson.storage.listdir(root)[1]
        names = [name for name in names if self.is_valid_version(name)]
        versions = [self.version_metadata(name) for name in names]
        versions.sort(reverse=True, key=operator.itemgetter("at"))
        return versions

    def get_version(self, name):
        path = self.get_version_path(name)
        with self.geojson.storage.open(path, "r") as f:
            return f.read()

    def get_version_path(self, name):
        return "{root}/{name}".format(root=self.storage_root(), name=name)

    def purge_old_versions(self):
        root = self.storage_root()
        versions = self.versions[settings.UMAP_KEEP_VERSIONS :]
        for version in versions:
            name = version["name"]
            # Should not be in the list, but ensure to not delete the file
            # currently used in database
            if self.geojson.name.endswith(name):
                continue
            try:
                self.geojson.storage.delete(os.path.join(root, name))
            except FileNotFoundError:
                pass

    def purge_gzip(self):
        root = self.storage_root()
        names = self.geojson.storage.listdir(root)[1]
        prefixes = [f"{self.pk}_"]
        if self.old_id:
            prefixes.append(f"{self.old_id}_")
        prefixes = tuple(prefixes)
        for name in names:
            if name.startswith(prefixes) and name.endswith(".gz"):
                self.geojson.storage.delete(os.path.join(root, name))

    def can_edit(self, request=None):
        """
        Define if a user can edit or not the instance, according to his account
        or the request.
        """
        if self.edit_status == self.INHERIT:
            return self.map.can_edit(request)
        can = False
        if not request:
            return False
        user = request.user
        if not self.map.owner:
            if settings.UMAP_ALLOW_ANONYMOUS and self.map.is_anonymous_owner(request):
                can = True
        if self.edit_status == self.ANONYMOUS:
            can = True
        elif user.is_authenticated and user == self.map.owner:
            can = True
        elif user.is_authenticated and self.edit_status == self.COLLABORATORS:
            if user in self.map.editors.all() or self.map.team in user.teams.all():
                can = True
        return can


class Star(models.Model):
    at = models.DateTimeField(auto_now=True)
    map = models.ForeignKey(Map, on_delete=models.CASCADE)
    by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="stars", on_delete=models.CASCADE
    )
