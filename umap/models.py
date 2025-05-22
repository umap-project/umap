import json
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.gis.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.files.base import File
from django.core.files.storage import storages
from django.core.signing import Signer
from django.urls import reverse
from django.utils.functional import classproperty
from django.utils.translation import gettext_lazy as _

from .managers import PrivateManager, PublicManager
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


def get_user_metadata(self):
    return {
        "id": self.pk,
        "name": str(self),
        "url": self.get_url(),
    }


User.add_to_class("__str__", display_name)
User.add_to_class("get_url", get_user_url)
User.add_to_class("get_stars_url", get_user_stars_url)
User.add_to_class("get_metadata", get_user_metadata)


def get_default_share_status():
    return settings.UMAP_DEFAULT_SHARE_STATUS or Map.DRAFT


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
    DRAFT = 0
    PUBLIC = 1
    OPEN = 2
    PRIVATE = 3
    BLOCKED = 9
    DELETED = 99
    ANONYMOUS_EDIT_STATUS = (
        (OWNER, _("Only editable with secret edit link")),
        (ANONYMOUS, _("Everyone can edit")),
    )
    EDIT_STATUS = (
        (ANONYMOUS, _("Everyone")),
        (COLLABORATORS, _("Editors and team only")),
        (OWNER, _("Owner only")),
    )
    ANONYMOUS_SHARE_STATUS = (
        (DRAFT, _("Draft (private)")),
        (PUBLIC, _("Everyone (public)")),
    )
    SHARE_STATUS = ANONYMOUS_SHARE_STATUS + (
        (OPEN, _("Anyone with link")),
        (PRIVATE, _("Editors and team only")),
        (BLOCKED, _("Blocked")),
        (DELETED, _("Deleted")),
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
    tags = ArrayField(models.CharField(max_length=200), blank=True, default=list)
    is_template = models.BooleanField(
        default=False,
        verbose_name=_("save as template"),
        help_text=_("This map is a template map."),
    )

    objects = models.Manager()
    public = PublicManager()
    private = PrivateManager()

    @property
    def description(self):
        try:
            return self.settings["properties"]["description"]
        except KeyError:
            return ""

    @property
    def datalayers(self):
        return self.datalayer_set.filter(share_status=DataLayer.INHERIT).all()

    @property
    def preview_settings(self):
        layers = self.datalayers
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
                "id": self.pk,
                "schema": self.extra_schema,
                "slideshow": {},
                "defaultLabelKeys": settings.UMAP_LABEL_KEYS,
            }
        )
        return map_settings

    def move_to_trash(self):
        self.share_status = Map.DELETED
        self.save()

    def delete(self, **kwargs):
        # Explicitely call datalayers.delete, so we can deal with removing files
        # (the cascade delete would not call the model delete method)
        # Use datalayer_set so to get also the deleted ones.
        for datalayer in self.datalayer_set.all():
            datalayer.delete()
        return super().delete(**kwargs)

    def generate_umapjson(self, request, include_data=True):
        umapjson = self.settings
        umapjson["type"] = "umap"
        umapjson["properties"].pop("is_template", None)
        umapjson["uri"] = request.build_absolute_uri(self.get_absolute_url())
        datalayers = []
        for datalayer in self.datalayers:
            layer = {}
            if include_data:
                with datalayer.geojson.open("rb") as f:
                    layer = json.loads(f.read())
            if datalayer.settings:
                datalayer.settings.pop("id", None)
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
        if self.share_status in [Map.BLOCKED, Map.DELETED]:
            can = False
        elif self.share_status in [Map.PUBLIC, Map.OPEN]:
            can = True
        elif self.owner is None:
            can = settings.UMAP_ALLOW_ANONYMOUS and self.is_anonymous_owner(request)
        elif not request.user.is_authenticated:
            can = False
        elif request.user == self.owner:
            can = True
        else:
            restricted = self.share_status in [Map.PRIVATE, Map.DRAFT]
            can = not (
                restricted
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
        for datalayer in self.datalayers:
            datalayer.clone(map_inst=new)
        return new

    def get_tags_display(self):
        labels = dict(settings.UMAP_TAGS)
        return [(t, labels.get(t, t)) for t in self.tags]

    @classproperty
    def extra_schema(self):
        return {
            "iconUrl": {
                "default": "%sumap/img/marker.svg" % settings.STATIC_URL,
            },
            "tags": {"choices": sorted(settings.UMAP_TAGS, key=lambda i: i[0])},
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
    return instance.geojson.storage.make_filename(instance)


def set_storage():
    return storages["data"]


class DataLayer(NamedModel):
    """
    Layer to store Features in.
    """

    INHERIT = 0
    ANONYMOUS = 1
    COLLABORATORS = 2
    OWNER = 3
    DELETED = 99
    SHARE_STATUS = (
        (INHERIT, _("Inherit")),
        (DELETED, _("Deleted")),
    )
    EDIT_STATUS = (
        (INHERIT, _("Inherit")),
        (ANONYMOUS, _("Everyone")),
        (COLLABORATORS, _("Editors and team only")),
        (OWNER, _("Owner only")),
    )
    ANONYMOUS_EDIT_STATUS = (
        (INHERIT, _("Inherit")),
        (OWNER, _("Only editable with secret edit link")),
        (ANONYMOUS, _("Everyone can edit")),
    )
    uuid = models.UUIDField(unique=True, primary_key=True, editable=False)
    old_id = models.IntegerField(null=True, blank=True)
    map = models.ForeignKey(Map, on_delete=models.CASCADE)
    description = models.TextField(blank=True, null=True, verbose_name=_("description"))
    geojson = models.FileField(
        upload_to=upload_to, blank=True, null=True, storage=set_storage
    )
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
    share_status = models.SmallIntegerField(
        choices=SHARE_STATUS,
        default=INHERIT,
        verbose_name=_("share status"),
    )
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("rank",)

    def save(self, **kwargs):
        super(DataLayer, self).save(**kwargs)
        self.geojson.storage.onDatalayerSave(self)
        if hasattr(self, "_reference_version"):
            del self._reference_version

    def delete(self, **kwargs):
        self.geojson.storage.onDatalayerDelete(self)
        return super().delete(**kwargs)

    def metadata(self, request=None):
        # Retrocompat: minimal settings for maps not saved after settings property
        # has been introduced
        metadata = self.settings
        if not metadata:
            # Fallback to file for old datalayers.
            try:
                data = json.loads(self.geojson.read().decode())
            except FileNotFoundError:
                data = {}
            metadata = data.get("_umap_options")
            if not metadata:
                metadata = {
                    "name": self.name,
                    "displayOnLoad": self.display_on_load,
                }
            # Save it to prevent file reading at each map load.
            self.settings = metadata
            # Do not update the modified_at.
            self.save(update_fields=["settings"])
        if self.old_id:
            metadata["old_id"] = self.old_id
        metadata["id"] = self.pk
        metadata["rank"] = self.rank
        metadata["permissions"] = {"edit_status": self.edit_status}
        metadata["editMode"] = "advanced" if self.can_edit(request) else "disabled"
        metadata["_referenceVersion"] = self.reference_version
        return metadata

    def clone(self, map_inst=None):
        new = self.__class__.objects.get(pk=self.pk)
        new._state.adding = True
        new.pk = uuid.uuid4()
        if map_inst:
            new.map = map_inst
        new.geojson = File(new.geojson.file.file, name="tmpname")
        new.save()
        return new

    @property
    def reference_version(self):
        if not hasattr(self, "_reference_version"):
            self._reference_version = self.geojson.storage.get_reference_version(self)
        return self._reference_version

    @property
    def versions(self):
        return self.geojson.storage.list_versions(self)

    def get_version(self, ref):
        return self.geojson.storage.get_version(ref, self)

    def get_version_path(self, ref):
        return self.geojson.storage.get_version_path(ref, self)

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

    def move_to_trash(self):
        self.share_status = DataLayer.DELETED
        self.save()


class Star(models.Model):
    at = models.DateTimeField(auto_now=True)
    map = models.ForeignKey(Map, on_delete=models.CASCADE)
    by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="stars", on_delete=models.CASCADE
    )
